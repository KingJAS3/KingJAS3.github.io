/**
 * scripts/process-jbook.js
 *
 * BUILD-TIME DATA PROCESSOR
 * ─────────────────────────
 * This Node.js script runs BEFORE the React app builds (via the "prebuild" npm hook).
 * It reads every budget file in fy2026_budget/, normalizes it into a consistent
 * JSON shape, and writes the results to public/data/ so the browser can fetch them.
 *
 * WHY build-time processing?
 *   The raw files are large (some > 18 MB) and use complex nested structures.
 *   Pre-processing means the browser only fetches small, clean, pre-shaped data.
 *
 * OUTPUT
 *   public/data/catalog.json   — index of all documents (drives the dropdowns)
 *   public/data/<id>.json      — one file per document (loaded on demand)
 *
 * SCHEMA NOTES (see also CLAUDE.md)
 *   EAS JSON/XML: Book → Book Section → Exhibit → Tab Strip → Tab → Grid
 *   Grid.Columns[].Code  = column identifier (e.g. "RowText", "Py", "By1")
 *   Grid.Columns[].Text  = display label     (e.g. "FY 2024\n Actuals")
 *   Grid.Rows[].Cells[].ColumnCode = which column this cell belongs to
 *   Grid.Rows[].Cells[].Value      = value as string with commas ("14,385")
 *   Dollar amounts are in THOUSANDS.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { XMLParser } from 'fast-xml-parser'
// xlsx (SheetJS) doesn't expose proper ES module named exports in v0.18 —
// we use createRequire to load it as CommonJS instead.
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

// __dirname isn't available in ES modules, so we reconstruct it from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'fy2026_budget')
const OUTPUT_DIR = path.join(ROOT, 'public', 'data')

// Limit rows per grid so output files stay manageable.
// Total-row and subtotal-row counts are kept separately for charts.
const MAX_DATA_ROWS = 200

// ── Human-readable labels for EAS column codes ──────────────────────────────
// These short codes come from the EAS (Electronic Accounting System) and are
// not self-explanatory. We translate them for display in the dashboard.
const COLUMN_LABELS = {
  RowText: 'Item',
  Py: 'FY2024 Actual',
  PyCyPricChan: 'Price Chg (FY24→25)',
  PyCyProgChan: 'Program Chg (FY24→25)',
  Cy: 'FY2025 Enacted',
  CyBy1PricChan: 'Price Chg (FY25→26)',
  CyBy1ProgChan: 'Program Chg (FY25→26)',
  By1: 'FY2026 Request',
  FyPy: 'FY2024 Actual',
  FyCy: 'FY2025 Enacted',
  FyBy1: 'FY2026 Request',
  FyBy1InThou: 'FY2026 Request ($K)',
  AccoTitl: 'Account Title',
  BudgActiTitl: 'Budget Activity',
  BudgLineItemTitl: 'Budget Line Item',
  ProgElem: 'Program Element',
  LocaStat: 'Location/Status',
  Line: 'Line No.',
  Amt: 'Amount',
  Perc: 'Percent',
  CyReq: 'CY Request',
  PyInfo: 'PY Info',
  ChanFromFyPyToFyCy: 'Change FY24→25',
  ChanFromFyCyToFyBy1: 'Change FY25→26',
}

// Columns that are purely for blank spacing — exclude from output
const SKIP_COLS = new Set(['Blnk1', 'Blnk2', 'Blnk3', 'AddRow'])

/**
 * Parse a dollar string like "14,385" or "1,505,375" into a number.
 * Returns null for empty or non-numeric values.
 * @param {string|number} val
 * @returns {number|null}
 */
function parseDollar(val) {
  if (val == null || val === '') return null
  const s = String(val).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/**
 * Determine if a column code represents a dollar/numeric amount.
 * Uses the column's Type field first, then falls back to naming conventions.
 * @param {string} code
 * @param {string} type - column Type from the EAS schema
 */
function isDollarCol(code, type) {
  if (type === 'numeric' || type === 'dollar') return true
  // Column codes starting with fiscal-year prefixes are money columns
  return /^(Py|Cy|By1|FyPy|FyCy|FyBy1|Amt|Chan|Pric|Prog)/.test(code) &&
         !/Titl|Text|Stat|Code|Elem/.test(code)
}

// ── EAS Tree Walker ──────────────────────────────────────────────────────────
// The EAS tree has two possible child locations:
//   node.Children           — used by TabStrip, Tab, Grid nodes
//   node.GeneratedOutput.Children — used by Book, BookSection, Exhibit nodes
// A node with BOTH Metadata AND GeneratedOutput is a "document entity wrapper"
// that needs to be unwrapped before we can see its Type and Children.

/**
 * If node has a {Metadata, GeneratedOutput} wrapper, return the inner GeneratedOutput.
 * Otherwise return the node as-is.
 * @param {object} node
 */
function unwrap(node) {
  // The presence of Metadata alongside GeneratedOutput indicates a wrapper node
  if (node && node.GeneratedOutput && 'Metadata' in node) {
    return node.GeneratedOutput
  }
  return node
}

/**
 * Get the children of a node, checking both possible locations.
 * @param {object} node - already-unwrapped node
 * @returns {Array}
 */
function getChildren(node) {
  if (Array.isArray(node.Children)) return node.Children
  if (node.GeneratedOutput && Array.isArray(node.GeneratedOutput.Children)) {
    return node.GeneratedOutput.Children
  }
  return []
}

/**
 * Recursively walk the EAS tree and yield every Grid node with its navigation path.
 * "tabPath" tracks which Tab Strip and Tab names led to this Grid,
 * so the dashboard can reconstruct drill-down navigation.
 *
 * This is a JavaScript generator function — calling it returns an iterator.
 * Each "yield" pauses the function and sends one value to the caller.
 *
 * @param {object} node
 * @param {string[]} tabPath - accumulated navigation breadcrumb
 */
function* walkGrids(node, tabPath = []) {
  const n = unwrap(node)
  if (!n || typeof n !== 'object') return

  if (n.Type === 'Grid') {
    yield { gridNode: n, tabPath: [...tabPath] }
    return
  }

  const myType = n.Type || ''
  const myName = (n.Name || n.Code || '').trim()

  // Only Tab Strip and Tab nodes add a breadcrumb segment — they represent
  // navigable sections in the document (like chapters and sub-chapters).
  const newPath = (myType === 'Tab Strip' || myType === 'Tab')
    ? [...tabPath, myName]
    : tabPath

  for (const child of getChildren(n)) {
    yield* walkGrids(child, newPath)
  }
}

/**
 * Extract a normalized grid object from a raw EAS Grid node.
 * Columns become { code, label, type }; Rows become { code, type, cells }.
 * Dollar values are parsed to numbers. Blank/spacing rows are dropped.
 * @param {object} gridNode
 * @param {string[]} tabPath
 * @returns {object}
 */
function extractGrid(gridNode, tabPath) {
  // Build column definitions, skipping blank-spacer columns
  const columns = (gridNode.Columns || [])
    .filter(c => c.Code && !SKIP_COLS.has(c.Code))
    .map(c => ({
      code: c.Code,
      // col.Text is the display label from EAS (may contain \n for line wrapping)
      label: (c.Text || COLUMN_LABELS[c.Code] || c.Code).replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim(),
      type: c.Type || 'text',
    }))

  const colSet = new Set(columns.map(c => c.code))
  const colTypeMap = Object.fromEntries(columns.map(c => [c.code, c.type]))

  // Separate blank rows (spacing) from real data
  const allRows = (gridNode.Rows || []).filter(r => r.Type !== 'blank')
  const totalRows = allRows.length
  const truncated = totalRows > MAX_DATA_ROWS

  const rows = allRows.slice(0, MAX_DATA_ROWS).map(row => {
    const cells = {}
    for (const cell of (row.Cells || [])) {
      const code = cell.ColumnCode
      if (!code || !colSet.has(code)) continue
      const raw = cell.Value ?? ''
      // Parse numeric columns to numbers so charts can use them directly
      cells[code] = isDollarCol(code, colTypeMap[code])
        ? parseDollar(raw)
        : String(raw).trim()
    }
    return { code: row.Code || null, type: row.Type || 'data', cells }
  })

  return {
    name: (gridNode.Name || gridNode.Code || 'Grid').trim(),
    tabPath,
    columns,
    rows,
    totalRows,
    truncated,
  }
}

// ── EAS JSON Parser ──────────────────────────────────────────────────────────

/**
 * Parse an EAS-format JSON object (already parsed from disk) into normalized grids.
 * Used for both .json files and XML files (after fast-xml-parser converts XML to JS).
 * @param {object} data - parsed JS object with {Metadata, GeneratedOutput}
 * @returns {{ metadata: object, grids: Array }|null}
 */
function parseEasData(data) {
  const rootOutput = data.GeneratedOutput
  if (!rootOutput) return null

  const grids = []
  for (const { gridNode, tabPath } of walkGrids(rootOutput, [])) {
    const g = extractGrid(gridNode, tabPath)
    if (g.columns.length > 0) grids.push(g) // skip empty grids
  }

  return { metadata: data.Metadata || {}, grids }
}

/**
 * Parse an EAS JSON file from disk.
 * @param {string} filePath - absolute path to .json file
 */
function parseEasJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return parseEasData(raw)
}

// ── XML Parser ───────────────────────────────────────────────────────────────

/**
 * Parse an Army/Air Force EAS XML file.
 * fast-xml-parser converts XML to a JS object with the same structure as the JSON files,
 * so we can reuse parseEasData() after parsing.
 * @param {string} filePath - absolute path to .xml file
 */
function parseXml(filePath) {
  const xmlText = fs.readFileSync(filePath, 'utf8')

  // fast-xml-parser settings:
  //   ignoreAttributes: false  — keep XML attributes (some EAS XML uses them)
  //   isArray: fn              — force these tags to always be arrays even with one item,
  //                              so we don't need to handle "array vs single object"
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['Children', 'Rows', 'Columns', 'Cells'].includes(name),
  })
  const obj = parser.parse(xmlText)

  // EAS XML files have the same {Metadata, GeneratedOutput} root structure as JSON.
  // Walk up the parsed object tree to find it.
  function findEasRoot(o, depth = 0) {
    if (!o || typeof o !== 'object' || depth > 5) return null
    if (o.GeneratedOutput) return o
    for (const v of Object.values(o)) {
      if (typeof v === 'object') {
        const found = findEasRoot(v, depth + 1)
        if (found) return found
      }
    }
    return null
  }

  const root = findEasRoot(obj)
  if (!root) return null
  return parseEasData(root)
}

// ── Excel Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a DoD Summary Excel (.xlsx) file.
 * Each worksheet becomes one "grid" in the output.
 * The xlsx library reads the file and gives us rows as arrays.
 * @param {string} filePath - absolute path to .xlsx file
 */
function parseExcel(filePath) {
  // cellText: true  — get values as strings (avoids date conversion issues)
  const workbook = XLSX.readFile(filePath, { cellText: false, cellDates: false })
  const grids = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    // sheet_to_json with header:1 gives us an array of row-arrays.
    // defval:'' fills empty cells with empty string (vs undefined).
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    if (rawRows.length < 2) continue

    // Find the header row — the first row with at least 4 non-empty cells.
    // DoD Excel files often have title/date rows above the actual column headers.
    let headerIdx = 0
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      if (rawRows[i].filter(v => v !== '').length >= 4) {
        headerIdx = i
        break
      }
    }

    const rawHeaders = rawRows[headerIdx]
    if (!rawHeaders.some(h => h !== '')) continue

    // Build column definitions from header row
    const columns = rawHeaders.map((h, i) => {
      const label = String(h).trim()
      const lc = label.toLowerCase()
      // Detect money columns by their header text
      const type = (lc.includes('amount') || lc.includes('$ ') || lc.includes('cost'))
        ? 'numeric' : 'text'
      return { code: `col_${i}`, label: label || `Col ${i}`, type }
    }).filter(c => c.label && c.label !== `Col ${c.code.slice(4)}` || rawHeaders[parseInt(c.code.slice(4))] !== '')

    // Re-filter to only keep columns with non-empty headers
    const validCols = rawHeaders
      .map((h, i) => ({ code: `col_${i}`, label: String(h).trim(), type: (String(h).toLowerCase().includes('amount') || String(h).toLowerCase().includes('$ ') ? 'numeric' : 'text') }))
      .filter(c => c.label.length > 0)

    const dataRows = rawRows
      .slice(headerIdx + 1)
      .filter(r => r.some(v => v !== ''))
      .slice(0, MAX_DATA_ROWS)
      .map((r, ri) => {
        const cells = {}
        rawHeaders.forEach((h, i) => {
          if (!String(h).trim()) return
          const v = r[i] ?? ''
          // xlsx returns numbers as JS numbers for numeric cells — keep as-is
          cells[`col_${i}`] = (typeof v === 'number') ? v : String(v).trim()
        })
        return { code: `row_${ri}`, type: 'data', cells }
      })

    grids.push({
      name: sheetName,
      tabPath: [sheetName],
      columns: validCols,
      rows: dataRows,
      totalRows: dataRows.length,
      truncated: false,
    })
  }

  return { metadata: { source: path.basename(filePath) }, grids }
}

// ── Catalog Metadata Helpers ─────────────────────────────────────────────────

/**
 * Given the relative file path inside fy2026_budget/, determine:
 *   service       — top-level organization (e.g. "Defense-Wide")
 *   appropriation — budget category (e.g. "Operation & Maintenance")
 *   docLabel      — human-readable document name
 *
 * These three values power the cascading dropdowns in the dashboard.
 * @param {string} relPath - e.g. "DefenseWide/O&M_Agencies/CYBERCOM_OP-5.json"
 * @returns {{ service: string, appropriation: string, docLabel: string }}
 */
function catalogMeta(relPath) {
  const parts = relPath.split(path.sep)
  const serviceDir = parts[0]
  const catDir = parts[1] || ''
  const filename = parts[parts.length - 1]

  const serviceMap = {
    DefenseWide: 'Defense-Wide',
    DoD_Summary: 'DoD Summary',
    Army: 'Army',
    AirForce: 'Air Force / Space Force',
  }
  const service = serviceMap[serviceDir] || serviceDir

  // Strip extension and clean up underscores/FY2026 prefix for display
  const docLabel = filename
    .replace(/\.(json|xml|xlsx?)$/i, '')
    .replace(/_/g, ' ')
    .replace(/^FY2026\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Map the raw directory name to a display-friendly appropriation label
  const catMap = {
    'O&M': 'Operation & Maintenance',
    'O&M_Agencies': 'Operation & Maintenance',
    BRAC: 'Base Realignment & Closure',
    'Military Personnel': 'Military Personnel',
    'Operation and Maintenance': 'Operation & Maintenance',
    Procurement: 'Procurement',
    rdte: 'RDT&E',
    RDTE: 'RDT&E',
    'Military Construction': 'Military Construction',
    awcf: 'Working Capital Fund',
    camdd: 'Chemical Agents & Munitions',
    MILPERS: 'Military Personnel',
    MILCON: 'Military Construction',
    'Other Funds': 'Other Funds',
  }
  let appropriation = catMap[catDir] || catDir || 'Other'

  // DoD Summary files encode the appropriation in the filename
  if (serviceDir === 'DoD_Summary') {
    if (filename.includes('P1R')) appropriation = 'Procurement Reserve (P-1R)'
    else if (filename.includes('P1_')) appropriation = 'Procurement (P-1)'
    else if (filename.includes('R1_RDTE')) appropriation = 'RDT&E (R-1)'
    else if (filename.includes('O1_')) appropriation = 'Operation & Maintenance (O-1)'
    else if (filename.includes('M1_')) appropriation = 'Military Personnel (M-1)'
    else if (filename.includes('C1_')) appropriation = 'Military Construction (C-1)'
    else if (filename.includes('RF1_')) appropriation = 'Revolving Fund (RF-1)'
    else if (filename.includes('Pacific_Deterrence')) appropriation = 'Pacific Deterrence Initiative'
    else if (filename.includes('Drug_Interdiction')) appropriation = 'Drug Interdiction'
  }

  return { service, appropriation, docLabel }
}

/**
 * Convert a human-readable string to a URL-safe identifier slug.
 * e.g. "CYBERCOM OP-5" → "cybercom-op-5"
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Main Processing Loop ─────────────────────────────────────────────────────

function main() {
  // If the raw data directory doesn't exist (e.g. in GitHub Actions where we use
  // pre-committed public/data/ files), skip processing and exit cleanly.
  if (!fs.existsSync(INPUT_DIR)) {
    console.log('No fy2026_budget/ directory found — skipping data processing.')
    console.log('Using existing public/data/ files (committed to git).')
    return
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const catalog = []  // will hold metadata for every processed document
  const errors = []

  /**
   * Walk a directory tree, calling processFile() on each file.
   * @param {string} dir - absolute path to directory
   * @param {string} relBase - relative path prefix for catalog entries
   */
  function walkDir(dir, relBase) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name)
      const relPath = path.join(relBase, entry.name)
      if (entry.isDirectory()) {
        walkDir(absPath, relPath)
      } else {
        processFile(absPath, relPath)
      }
    }
  }

  function processFile(absPath, relPath) {
    const ext = path.extname(absPath).toLowerCase()
    if (!['.json', '.xml', '.xlsx', '.xls'].includes(ext)) return

    const { service, appropriation, docLabel } = catalogMeta(relPath)
    const id = slugify(`${service} ${appropriation} ${docLabel}`)
    const outFile = `${id}.json`
    const outPath = path.join(OUTPUT_DIR, outFile)

    console.log(`  Processing: ${relPath}`)

    let parsed = null
    try {
      if (ext === '.json')  parsed = parseEasJson(absPath)
      else if (ext === '.xml')  parsed = parseXml(absPath)
      else if (ext === '.xlsx' || ext === '.xls') parsed = parseExcel(absPath)
    } catch (err) {
      console.error(`    ERROR: ${err.message}`)
      errors.push({ file: relPath, error: err.message })
      return
    }

    if (!parsed || !parsed.grids || parsed.grids.length === 0) {
      console.log(`    (no grids found, skipping)`)
      return
    }

    const doc = {
      id,
      service,
      appropriation,
      document: docLabel,
      sourceFile: relPath,
      type: ext.replace('.', ''),
      grids: parsed.grids,
    }

    // Write minified JSON (no pretty-printing) to keep file sizes small
    fs.writeFileSync(outPath, JSON.stringify(doc))
    console.log(`    -> ${outFile} (${parsed.grids.length} grid(s))`)

    catalog.push({
      id,
      service,
      appropriation,
      document: docLabel,
      file: outFile,
      gridCount: parsed.grids.length,
    })
  }

  console.log('\nProcessing budget files...\n')
  walkDir(INPUT_DIR, '')

  // Sort catalog alphabetically so dropdown options appear in a logical order
  catalog.sort((a, b) => {
    if (a.service !== b.service) return a.service.localeCompare(b.service)
    if (a.appropriation !== b.appropriation) return a.appropriation.localeCompare(b.appropriation)
    return a.document.localeCompare(b.document)
  })

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'catalog.json'),
    JSON.stringify(catalog, null, 2)
  )

  const ok = catalog.length
  const fail = errors.length
  console.log(`\n✓ ${ok} documents written to public/data/`)
  if (fail > 0) {
    console.error(`✗ ${fail} errors:`)
    errors.forEach(e => console.error(`    ${e.file}: ${e.error}`))
  }
}

main()
