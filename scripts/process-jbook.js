/**
 * scripts/process-jbook.js
 *
 * BUILD-TIME DATA PROCESSOR
 * ─────────────────────────
 * Runs before the React build (via the "prebuild" npm hook).
 * Reads every budget file in fy2026_budget/, normalizes it into a consistent
 * JSON shape, and writes results to public/data/ for the browser to fetch.
 *
 * OUTPUT
 *   public/data/catalog.json   — index of all documents (drives the dropdowns)
 *   public/data/<id>.json      — one file per document (loaded on demand)
 *
 * SUPPORTED FORMATS
 *   1. EAS JSON — Electronic Accounting System (Army O&M JSON, Defense-Wide JSON)
 *   2. EAS XML  — Same schema serialized as XML (rare; most Army XML is Tagged PDF)
 *   3. Tagged PDF XML — PDF → XML via Acrobat; contains <Table>/<TR>/<TH>/<TD>
 *   4. Excel (.xlsx) — DoD Summary display files
 *
 * Dollar amounts are always in THOUSANDS in source files.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { XMLParser } from 'fast-xml-parser'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'fy2026_budget')
const OUTPUT_DIR = path.join(ROOT, 'public', 'data')

const MAX_DATA_ROWS = 200

// ── Human-readable labels for EAS column codes ────────────────────────────────
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

const SKIP_COLS = new Set(['Blnk1', 'Blnk2', 'Blnk3', 'AddRow'])

// ── Shared utilities ──────────────────────────────────────────────────────────

function parseDollar(val) {
  if (val == null || val === '') return null
  const s = String(val).replace(/,/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function isDollarCol(code, type) {
  if (type === 'numeric' || type === 'dollar') return true
  return /^(Py|Cy|By1|FyPy|FyCy|FyBy1|Amt|Chan|Pric|Prog)/.test(code) &&
         !/Titl|Text|Stat|Code|Elem/.test(code)
}

// ── EAS Tree Walker ───────────────────────────────────────────────────────────

function unwrap(node) {
  if (node && node.GeneratedOutput && 'Metadata' in node) {
    return node.GeneratedOutput
  }
  return node
}

function getChildren(node) {
  if (Array.isArray(node.Children)) return node.Children
  if (node.GeneratedOutput && Array.isArray(node.GeneratedOutput.Children)) {
    return node.GeneratedOutput.Children
  }
  return []
}

function* walkGrids(node, tabPath = []) {
  const n = unwrap(node)
  if (!n || typeof n !== 'object') return

  if (n.Type === 'Grid') {
    yield { gridNode: n, tabPath: [...tabPath] }
    return
  }

  const myType = n.Type || ''
  const myName = (n.Name || n.Code || '').trim()

  const newPath = (myType === 'Tab Strip' || myType === 'Tab')
    ? [...tabPath, myName]
    : tabPath

  for (const child of getChildren(n)) {
    yield* walkGrids(child, newPath)
  }
}

function extractGrid(gridNode, tabPath) {
  const columns = (gridNode.Columns || [])
    .filter(c => c.Code && !SKIP_COLS.has(c.Code))
    .map(c => ({
      code: c.Code,
      label: (c.Text || COLUMN_LABELS[c.Code] || c.Code).replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim(),
      type: c.Type || 'text',
    }))

  const colSet = new Set(columns.map(c => c.code))
  const colTypeMap = Object.fromEntries(columns.map(c => [c.code, c.type]))

  const allRows = (gridNode.Rows || []).filter(r => r.Type !== 'blank')
  const totalRows = allRows.length
  const truncated = totalRows > MAX_DATA_ROWS

  const rows = allRows.slice(0, MAX_DATA_ROWS).map(row => {
    const cells = {}
    for (const cell of (row.Cells || [])) {
      const code = cell.ColumnCode
      if (!code || !colSet.has(code)) continue
      const raw = cell.Value ?? ''
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

// ── EAS JSON Parser ───────────────────────────────────────────────────────────

function parseEasData(data) {
  const rootOutput = data.GeneratedOutput
  if (!rootOutput) return null

  const grids = []
  for (const { gridNode, tabPath } of walkGrids(rootOutput, [])) {
    const g = extractGrid(gridNode, tabPath)
    if (g.columns.length > 0) grids.push(g)
  }

  return { metadata: data.Metadata || {}, grids }
}

function parseEasJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  return parseEasData(raw)
}

// ── XML Parser (dispatches between EAS XML and Tagged PDF XML) ────────────────

function parseXml(filePath) {
  const xmlText = fs.readFileSync(filePath, 'utf8')

  // Detect Tagged PDF XML format (Army/AF justification books exported from PDF)
  if (xmlText.slice(0, 800).includes('<TaggedPDF-doc>')) {
    return parseTaggedPdfXml(xmlText, filePath)
  }

  // Try EAS XML format (same schema as EAS JSON, serialized as XML)
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['Children', 'Rows', 'Columns', 'Cells'].includes(name),
  })
  const obj = parser.parse(xmlText)

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

// ── Tagged PDF XML Parser ─────────────────────────────────────────────────────
//
// Army/AF J-Books are exported from PDF via Acrobat "SaveAsXML".
// The result is a <TaggedPDF-doc> with narrative markup and embedded
// <Table>/<TR>/<TH>/<TD> elements containing budget data.
// This parser extracts those tables and normalizes them into the same
// {columns, rows} shape as EAS grids.

/**
 * Extract text content from a TH or TD element, stripping child tags
 * and decoding XML entities.
 */
function cleanCellText(raw) {
  return (raw || '')
    .replace(/<[^>]+>/g, '')          // strip any nested tags (e.g. <Figure>)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract all TH and TD cells from a <TR> element's content string.
 * Handles both normal tags (<TD>text</TD>) and self-closing (<TD/>).
 */
function extractTaggedPdfCells(trContent) {
  const cells = []
  // Match self-closing tags first, then normal tags — combined in one regex
  // Group 1: tag type for self-closing (<TH/> or <TD/>)
  // Group 2: tag type for normal open tag
  // Group 3: content between normal open and close
  const pattern = /<(TH|TD)(?:[^>]*)?\s*\/>|<(TH|TD)(?:[^>]*)?>([^]*?)<\/(?:TH|TD)>/gi
  for (const m of trContent.matchAll(pattern)) {
    if (m[1]) {
      // Self-closing: <TD/> or <TH/>
      cells.push({ type: m[1].toUpperCase(), text: '' })
    } else if (m[2]) {
      cells.push({ type: m[2].toUpperCase(), text: cleanCellText(m[3]) })
    }
  }
  return cells
}

/**
 * A row is a header row if all its cells are TH, or if its TD cells
 * contain no parseable dollar amounts (meaning they're subcategory labels,
 * not data).
 */
function isTaggedPdfHeaderRow(row) {
  if (row.every(c => c.type === 'TH')) return true
  const tdCells = row.filter(c => c.type === 'TD')
  const hasNumericTd = tdCells.some(c => parseDollar(c.text) != null)
  return !hasNumericTd
}

/**
 * Build column definitions from 1–2 header rows.
 * If there are 2 header rows, the first is assumed to be a "super-header"
 * with FY year labels (e.g. "FY 2024", "FY 2025", "FY 2026"), and the
 * second has subcategory labels (e.g. "Actuals", "Enacted", "Request").
 * These are combined: "FY 2024 Actuals", "FY 2025 Enacted", etc.
 *
 * Column type detection:
 *   - First column → always text (row label)
 *   - Columns under a "FY XXXX" super-header → numeric (dollar/quantity data)
 *   - Columns whose label contains fiscal/amount keywords → numeric
 *   - Everything else → text
 *
 * Column codes: first column → 'RowText' (label), others → 'pdfc_N'.
 */
function buildTaggedPdfColumns(headerRows) {
  if (headerRows.length === 0) return []

  const mainHeader = headerRows[headerRows.length - 1]
  const superHeader = headerRows.length > 1 ? headerRows[0] : null

  return mainHeader.map((cell, i) => {
    let label = cell.text || ''

    let superText = null
    if (superHeader && i > 0) {
      // Super-header has no label column, so offset by 1
      const superIdx = i - 1
      if (superIdx < superHeader.length) {
        superText = (superHeader[superIdx].text || '').trim()
        if (superText && /FY\s*20\d\d/i.test(superText)) {
          // Combine FY year with sub-label; fall back to FY year alone if sub-label is empty
          label = label
            ? `${superText} ${label}`.replace(/\s+/g, ' ').trim()
            : superText
        }
      }
    }

    // Determine column type:
    // - Under a FY-year super-header → numeric
    // - Label contains fiscal/amount keywords → numeric
    // - First column (row labels) or descriptive text → text
    const isLabel = i === 0
    const fySuper = superText && /FY\s*20\d\d/i.test(superText)
    const fyLabel = /FY\s*\d{4}|amount|cost|\$|total|enacted|actuals?|request|prior|outyear|quantit/i.test(label)
    const isNumeric = !isLabel && (fySuper || fyLabel)

    return {
      code: isLabel ? 'RowText' : `pdfc_${i}`,
      label: label || `Col ${i}`,
      type: isLabel ? 'text' : (isNumeric ? 'numeric' : 'text'),
    }
  })
}

/**
 * Extract a human-readable table name from the text that appears before
 * the table in the document (headings, paragraph labels).
 */
function extractTaggedPdfTableName(contextBefore, tableIndex) {
  // Find headings and paragraphs with meaningful content
  const matches = [...contextBefore.matchAll(/<(H[1-6]|P)(?:[^>]*)?>([^<]{8,300})<\/\1>/gi)]

  for (let i = matches.length - 1; i >= 0; i--) {
    const text = matches[i][2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()

    // Skip generic/boilerplate labels
    if (/^(UNCLASSIFIED|Page \d|Department of Defense|Department of the|Jun \d|FY \d{4} President|\(Dollars?)/i.test(text)) continue
    if (text.length < 5) continue

    // Prefer an "Exhibit X-N" reference if present
    const exhibitMatch = text.match(/Exhibit\s+[A-Z0-9-]+(?:\s+[A-Z][A-Za-z\s,&]{0,40})?/i)
    if (exhibitMatch) return exhibitMatch[0].replace(/\s+/g, ' ').trim().slice(0, 80)

    return text.length > 80 ? text.slice(0, 80) + '…' : text
  }

  return `Table ${tableIndex + 1}`
}

/**
 * Main Tagged PDF XML parser.
 * Finds every <Table> element, extracts its header and data rows,
 * and returns a normalized document with grids.
 */
function parseTaggedPdfXml(xmlText, filePath) {
  const filename = path.basename(filePath, path.extname(filePath))
  const grids = []

  for (const tableMatch of xmlText.matchAll(/<Table[^>]*>([\s\S]*?)<\/Table>/gi)) {
    const tableContent = tableMatch[1]
    const matchStart = tableMatch.index

    // Context window before this table for naming
    const contextBefore = xmlText.slice(Math.max(0, matchStart - 700), matchStart)
    const tableName = extractTaggedPdfTableName(contextBefore, grids.length)

    // Extract rows
    const allRows = []
    for (const trMatch of tableContent.matchAll(/<TR[^>]*>([\s\S]*?)<\/TR>/gi)) {
      const cells = extractTaggedPdfCells(trMatch[1])
      if (cells.length > 0) allRows.push(cells)
    }

    if (allRows.length < 2) continue  // need at least 1 header + 1 data row

    // Identify header rows at the start of the table
    let headerEnd = 0
    for (let i = 0; i < Math.min(4, allRows.length - 1); i++) {
      if (isTaggedPdfHeaderRow(allRows[i])) {
        headerEnd = i + 1
      } else {
        break
      }
    }
    if (headerEnd === 0) headerEnd = 1  // treat first row as header if detection fails

    const headerRows = allRows.slice(0, headerEnd)
    const dataRows = allRows.slice(headerEnd)
    if (dataRows.length === 0) continue

    const columns = buildTaggedPdfColumns(headerRows)
    if (columns.length === 0) continue

    // Build normalized rows
    const rows = []
    for (const row of dataRows.slice(0, MAX_DATA_ROWS)) {
      // Skip entirely empty rows
      if (row.every(c => !c.text)) continue

      const cells = {}
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        const cell = i < row.length ? row[i] : null
        const val = cell ? cell.text : ''
        cells[col.code] = col.type === 'numeric' ? parseDollar(val) : val
      }

      // Determine row type from cell tag types
      const allTh = row.every(c => c.type === 'TH')
      const rowType = allTh ? 'subtotal' : 'data'

      // Skip rows with no data at all
      const hasData = Object.values(cells).some(v => v != null && v !== '')
      if (!hasData) continue

      rows.push({ code: null, type: rowType, cells })
    }

    if (rows.length === 0) continue

    grids.push({
      name: tableName,
      tabPath: [tableName],
      columns,
      rows,
      totalRows: dataRows.length,
      truncated: dataRows.length > MAX_DATA_ROWS,
    })
  }

  if (grids.length === 0) return null
  return { metadata: { source: filename, sourceType: 'tagged-pdf' }, grids }
}

// ── Excel Parser ──────────────────────────────────────────────────────────────

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellText: false, cellDates: false })
  const grids = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    if (rawRows.length < 2) continue

    let headerIdx = 0
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      if (rawRows[i].filter(v => v !== '').length >= 4) {
        headerIdx = i
        break
      }
    }

    const rawHeaders = rawRows[headerIdx]
    if (!rawHeaders.some(h => h !== '')) continue

    const validCols = rawHeaders
      .map((h, i) => ({
        code: `col_${i}`,
        label: String(h).trim(),
        type: (String(h).toLowerCase().includes('amount') || String(h).toLowerCase().includes('$ ')
          ? 'numeric' : 'text'),
      }))
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

// ── Catalog Metadata Helpers ──────────────────────────────────────────────────

/**
 * Shorten common long phrases in document labels for cleaner dropdown display.
 */
function cleanDocLabel(label) {
  return label
    .replace(/Operation and Maintenance/gi, 'O&M')
    .replace(/Research,? Development,? Test(?:ing)? and Evaluation/gi, 'RDT&E')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Given a relative file path inside fy2026_budget/, determine the
 * service, appropriation, and document display labels.
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

  // Strip extension, clean underscores, remove FY2026 prefix
  let docLabel = filename
    .replace(/\.(json|xml|xlsx?)$/i, '')
    .replace(/_/g, ' ')
    .replace(/^FY2026\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  docLabel = cleanDocLabel(docLabel)

  // Map raw directory names to display appropriation labels
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
    'U.S. Army Cemeterial Expenses and Construction': 'Cemeterial Expenses',
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

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Main Processing Loop ──────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.log('No fy2026_budget/ directory found — skipping data processing.')
    console.log('Using existing public/data/ files (committed to git).')
    return
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const catalog = []
  const errors = []

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
