/**
 * scripts/process-jbook.js
 *
 * BUILD-TIME DATA PROCESSOR (Complete Rebuild)
 * ─────────────────────────────────────────────
 * Runs before the React build (via the "prebuild" npm hook).
 * Reads every budget file in fy2026_budget/, normalizes it into a consistent
 * JSON shape, and writes results to public/data/ for the browser to fetch.
 *
 * OUTPUT
 *   public/data/catalog.json   — index of all documents (drives the dropdowns)
 *   public/data/<id>.json      — one file per document (loaded on demand)
 *
 * SUPPORTED FORMATS
 *   1. EAS JSON  — Electronic Accounting System (Army O&M, Defense-Wide)
 *   2. EAS XML   — Same schema serialized as XML
 *   3. Tagged PDF XML — PDF → XML via Acrobat; <Table>/<TR>/<TH>/<TD>
 *   4. Word XML   — Office Open XML flat package (<pkg:package>)
 *   5. Excel (.xlsx) — DoD Summary display files
 *
 * SCHEMA REFERENCE: See SCHEMA_REFERENCE.md for detailed analysis of all formats.
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

// ── Skip columns ─────────────────────────────────────────────────────────────
// Visual spacers / header-only columns found across all EAS JSON files.
// From SCHEMA_REFERENCE.md sections 3a (Volume 1 & 2 column codes).
const SKIP_COLS = new Set([
  'Blnk1', 'Blnk2', 'Blnk3', 'AddRow',
  'BlnkCol', 'BlnkCol_1', 'BlnkCol_3',
  'numeric', 'numeric_1', 'numeric_2', 'numeric_3', 'numeric_4',
  'lvl1Col_1', 'lvl1Col_2', 'lvl1Col_3', 'lvl1Col_4', 'lvl1Col_5',
  'Lvl1Col_3Cy',
  'PyHeader', 'ThouHeader', 'RateHeader',
  'TotaObliAuthDollInTh',
])

// ── Human-readable labels for EAS column codes ──────────────────────────────
const COLUMN_LABELS = {
  RowText: 'Item',
  Py: 'FY2024 Actual',
  Cy: 'FY2025 Enacted',
  By1: 'FY2026 Request',
  By2: 'FY2027',
  By3: 'FY2028',
  By4: 'FY2029',
  By5: 'FY2030',
  FyPy: 'FY2024 Actual',
  FyCy: 'FY2025 Enacted',
  FyBy1: 'FY2026 Request',
  FyBy1InThou: 'FY2026 Request ($K)',
  FyPyNEnac: 'FY2024 Actuals',
  FyCyNEsti: 'FY2025 Enacted',
  FyBy1NChan: 'FY2026 Estimate',
  FyBy1Requ: 'FY2026 Request',
  PyCyPricChan: 'Price Chg (FY24→25)',
  PyCyProgChan: 'Program Chg (FY24→25)',
  CyBy1PricChan: 'Price Chg (FY25→26)',
  CyBy1ProgChan: 'Program Chg (FY25→26)',
  PricNChan: 'Price Change',
  PricNChan_1: 'Price Change',
  ProgNChan: 'Program Change',
  ProgNChan_1: 'Program Change',
  PyCyFcRateDiff: 'FC Rate Diff (FY24→25)',
  PyCyPricGrowPerc: 'Price Growth % (FY24→25)',
  PyCyPricGrow: 'Price Growth (FY24→25)',
  PyCyProgGrow: 'Program Growth (FY24→25)',
  CyBy1FcRateDiff: 'FC Rate Diff (FY25→26)',
  CyBy1PricGrowPerc: 'Price Growth % (FY25→26)',
  CyBy1PricGrow: 'Price Growth (FY25→26)',
  CyBy1ProgGrow: 'Program Growth (FY25→26)',
  ChanCyBy: 'Change FY25/26',
  ChanFyCyBy1: 'Change FY25/26',
  ChanFycy: 'Change FY25/25',
  ChanFyby1: 'Change FY25/26',
  ChanNFyCyBy1: 'Change FY25/26',
  AccoTitl: 'Account Title',
  BudgActiTitl: 'Budget Activity',
  BudgLineItemTitl: 'Budget Line Item',
  ProgElem: 'Program Element',
  CyReq: 'CY Request',
  CyAppn: 'CY Appropriation',
  RecoCate: 'Reconciliation Category',
  Amt: 'Amount',
  Perc: 'Percent',
  Tota: 'Total',
  Line: 'Line No.',
  LineItem: 'Line Item',
  BudgActi: 'Budget Activity',
  BudgRequ: 'Budget Request',
  Current: 'Current Enacted',
  CyBy1Chan: 'FY25/26 Change',
  UsDireHire: 'US Direct Hire',
  DireHire: 'Direct Hire',
  IndiHire: 'Indirect Hire',
  ForeNati: 'Foreign National',
  Narrative: 'Narrative',
  // OP-8 civilian personnel
  begin_strength: 'Begin Strength',
  end_strength: 'End Strength',
  fte: 'FTEs',
  basic_comp: 'Basic Comp',
  overtime_pay: 'Overtime Pay',
  holiday_pay: 'Holiday Pay',
  other_oc11: 'Other OC 11',
  total_variables: 'Total Variables',
  comp_oc11: 'Comp OC 11',
  benefits_oc12_13: 'Benefits OC 12/13',
  comp_benefits: 'Comp & Benefits',
  basic_comp_rate: 'Basic Comp Rate',
  total_comp_rate: 'Total Comp Rate',
  comp_benefits_rate: 'Comp & Benefits Rate',
  bc_variables: '% BC Variables',
  bc_benefits: '% BC Benefits',
  // Personnel Part 4
  PyBase: 'PY Baseline',
  PyFte: 'PY FTE',
  CyBase: 'CY Baseline',
  CyFte: 'CY FTE',
  By1Base: 'BY1 Baseline',
  By1Fte: 'BY1 FTE',
}

// ── Shared Utilities ─────────────────────────────────────────────────────────

/** Strip commas and parse a dollar/numeric string to a float. */
function parseDollar(val) {
  if (val == null || val === '') return null
  const s = String(val).replace(/,/g, '').replace(/\s/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/** Determine if an EAS column code represents a numeric (dollar/quantity) value. */
function isNumericCol(code, type) {
  if (type === 'numeric' || type === 'dollar' || type === 'percent') return true
  return /^(Py|Cy|By[1-5]|FyPy|FyCy|FyBy1|Amt|Chan|Pric|Prog|begin_|end_|fte|basic_|overtime|holiday|other_oc|total_|comp_|benefits_|bc_|PyBase|CyBase|By1Base|PyFte|CyFte|By1Fte|BudgRequ|Current|CyBy1Chan|UsDireHire|DireHire|IndiHire|Tota$|FyPyN|FyCyN|FyBy1N|FyBy1Requ|FyPyPyh|FyCyCyh|FyBy1By1h)/i.test(code) &&
    !/Titl|Text|Stat|Code$|Elem$|Cate$|Header/i.test(code)
}

/** Strip HTML/XML tags, decode entities, collapse whitespace. */
function cleanCellText(raw) {
  return (raw || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** URL-safe document ID from a string. */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Detect dollar unit from header text or context.
 * Returns 'millions' or 'thousands' (default).
 */
function detectDollarUnit(text) {
  if (!text) return 'thousands'
  if (/\$\s*in\s*millions|\(\s*\$\s*M\s*\)|dollars?\s*in\s*millions/i.test(text)) return 'millions'
  return 'thousands'
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EAS JSON PARSER
// ═══════════════════════════════════════════════════════════════════════════════

/** Unwrap EAS document entity wrapper (has both Metadata and GeneratedOutput). */
function unwrap(node) {
  if (node && node.GeneratedOutput && 'Metadata' in node) {
    return node.GeneratedOutput
  }
  return node
}

/** Get children from either node.Children or node.GeneratedOutput.Children. */
function getChildren(node) {
  if (Array.isArray(node.Children)) return node.Children
  if (node.GeneratedOutput && Array.isArray(node.GeneratedOutput.Children)) {
    return node.GeneratedOutput.Children
  }
  return []
}

/** Generator: walk the EAS tree and yield all Grid nodes with their tab paths. */
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

/**
 * Convert an EAS Grid node into normalized shape.
 * Handles:
 *   - Normal grids with column definitions
 *   - Part 3C1 grids with 0 column definitions (implicit RowText/Amt/Narrative)
 */
function extractGrid(gridNode, tabPath) {
  let columns = (gridNode.Columns || [])
    .filter(c => c.Code && !SKIP_COLS.has(c.Code))
    .map(c => ({
      code: c.Code,
      label: (c.Text || COLUMN_LABELS[c.Code] || c.Code)
        .replace(/\\n|\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      type: c.Type || 'text',
    }))

  // Handle Part 3C1 grids with 0 column definitions (implicit columns)
  // Cells reference RowText, Amt, Narrative but they're not in Columns[]
  if (columns.length === 0 && gridNode.Rows && gridNode.Rows.length > 0) {
    const implicitCodes = new Set()
    for (const row of gridNode.Rows) {
      for (const cell of (row.Cells || [])) {
        if (cell.ColumnCode) implicitCodes.add(cell.ColumnCode)
      }
    }
    if (implicitCodes.size > 0) {
      const implicitTypes = { RowText: 'text', Amt: 'dollar', Narrative: 'text' }
      columns = [...implicitCodes]
        .filter(code => !SKIP_COLS.has(code))
        .map(code => ({
          code,
          label: COLUMN_LABELS[code] || code,
          type: implicitTypes[code] || 'text',
        }))
    }
  }

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
      cells[code] = isNumericCol(code, colTypeMap[code])
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
    dollarUnit: 'thousands',
  }
}

/** Parse a complete EAS JSON file. */
function parseEasJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const rootOutput = raw.GeneratedOutput
  if (!rootOutput) return null

  const grids = []
  for (const { gridNode, tabPath } of walkGrids(rootOutput, [])) {
    const g = extractGrid(gridNode, tabPath)
    if (g.columns.length > 0 || g.rows.length > 0) grids.push(g)
  }

  return { metadata: raw.Metadata || {}, grids }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAGGED PDF XML PARSER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract all TH and TD cells from a <TR> element's content string.
 * Handles both normal tags (<TD>text</TD>) and self-closing (<TD/>).
 */
function extractTaggedPdfCells(trContent) {
  const cells = []
  const pattern = /<(TH|TD)(?:[^>]*)?\s*\/>|<(TH|TD)(?:[^>]*)?>([^]*?)<\/(?:TH|TD)>/gi
  for (const m of trContent.matchAll(pattern)) {
    if (m[1]) {
      cells.push({ type: m[1].toUpperCase(), text: '' })
    } else if (m[2]) {
      cells.push({ type: m[2].toUpperCase(), text: cleanCellText(m[3]) })
    }
  }
  return cells
}

/**
 * Determine if a row is a header row.
 * A row is header if:
 *   - All cells are TH, or
 *   - TD cells contain no parseable numeric values
 */
function isTaggedPdfHeaderRow(row) {
  if (row.every(c => c.type === 'TH')) return true
  const tdCells = row.filter(c => c.type === 'TD')
  if (tdCells.length === 0) return true
  const hasNumericTd = tdCells.some(c => {
    const v = parseDollar(c.text)
    return v != null && v !== 0
  })
  return !hasNumericTd
}

/**
 * Build column definitions from 1–2 header rows.
 * Handles:
 *   - Single header row (most common)
 *   - FY super-header + subcategory row (multi-row)
 *   - Column-splitting artifacts (5-10% of RDTE/Procurement tables)
 *
 * Column type detection:
 *   - First column → always text (row label)
 *   - Under a "FY XXXX" super-header → numeric
 *   - Label containing fiscal/amount keywords → numeric
 *   - Everything else → text
 */
function buildTaggedPdfColumns(headerRows) {
  if (headerRows.length === 0) return []

  const mainHeader = headerRows[headerRows.length - 1]
  const superHeader = headerRows.length > 1 ? headerRows[0] : null

  // Detect dollar unit from headers
  let dollarUnit = 'thousands'
  for (const hr of headerRows) {
    for (const cell of hr) {
      const detected = detectDollarUnit(cell.text)
      if (detected === 'millions') { dollarUnit = 'millions'; break }
    }
    if (dollarUnit === 'millions') break
  }

  const columns = mainHeader.map((cell, i) => {
    let label = cell.text || ''

    let superText = null
    if (superHeader && i > 0) {
      const superIdx = i - 1
      if (superIdx < superHeader.length) {
        superText = (superHeader[superIdx].text || '').trim()
        if (superText && /FY\s*20\d\d/i.test(superText)) {
          label = label
            ? `${superText} ${label}`.replace(/\s+/g, ' ').trim()
            : superText
        }
      }
    }

    const isLabel = i === 0
    const fySuper = superText && /FY\s*20\d\d/i.test(superText)
    const fyLabel = /FY\s*\d{4}|amount|cost|\$|total|enacted|actuals?|request|prior|outyear|quantit|reconcil/i.test(label)
    const isNumeric = !isLabel && (fySuper || fyLabel)

    return {
      code: isLabel ? 'RowText' : `pdfc_${i}`,
      label: label || `Col ${i}`,
      type: isLabel ? 'text' : (isNumeric ? 'numeric' : 'text'),
    }
  })

  columns._dollarUnit = dollarUnit
  return columns
}

/**
 * Extract a human-readable table name from preceding headings/paragraphs.
 */
function extractTaggedPdfTableName(contextBefore, tableIndex) {
  const matches = [...contextBefore.matchAll(/<(H[1-6]|P)(?:[^>]*)?>([^<]{8,300})<\/\1>/gi)]

  for (let i = matches.length - 1; i >= 0; i--) {
    const text = matches[i][2]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()

    if (/^(UNCLASSIFIED|Page \d|Department of Defense|Department of the|Jun \d|FY \d{4} President|\(Dollars?)/i.test(text)) continue
    if (text.length < 5) continue

    const exhibitMatch = text.match(/Exhibit\s+[A-Z0-9-]+(?:\s+[A-Z][A-Za-z\s,&]{0,40})?/i)
    if (exhibitMatch) return exhibitMatch[0].replace(/\s+/g, ' ').trim().slice(0, 80)

    return text.length > 80 ? text.slice(0, 80) + '…' : text
  }

  return `Table ${tableIndex + 1}`
}

/**
 * Detect if a table is a narrative-only table (all-TH, no actual data).
 * These are common in O&M reconciliation text and RDTE exhibit headers.
 */
function isNarrativeTable(rows) {
  if (rows.length === 0) return true
  // If all rows are all-TH and have 1-2 columns, it's likely narrative
  const allTh = rows.every(r => r.every(c => c.type === 'TH'))
  if (allTh && rows[0].length <= 2) return true
  return false
}

/**
 * Main Tagged PDF XML parser.
 * Finds every <Table>, extracts headers and data, normalizes to grid format.
 */
function parseTaggedPdfXml(xmlText, filePath) {
  const filename = path.basename(filePath, path.extname(filePath))
  const grids = []

  // Detect file-level dollar unit from content
  let fileUnit = 'thousands'
  if (/\(\s*\$\s*in\s*millions\s*\)/i.test(xmlText.slice(0, 5000))) {
    fileUnit = 'millions'
  }

  for (const tableMatch of xmlText.matchAll(/<Table[^>]*>([\s\S]*?)<\/Table>/gi)) {
    const tableContent = tableMatch[1]
    const matchStart = tableMatch.index

    const contextBefore = xmlText.slice(Math.max(0, matchStart - 700), matchStart)
    const tableName = extractTaggedPdfTableName(contextBefore, grids.length)

    // Extract rows
    const allRows = []
    for (const trMatch of tableContent.matchAll(/<TR[^>]*>([\s\S]*?)<\/TR>/gi)) {
      const cells = extractTaggedPdfCells(trMatch[1])
      if (cells.length > 0) allRows.push(cells)
    }

    if (allRows.length < 2) continue

    // Skip narrative-only tables
    if (isNarrativeTable(allRows)) continue

    // Identify header rows at start of table
    let headerEnd = 0
    for (let i = 0; i < Math.min(5, allRows.length - 1); i++) {
      if (isTaggedPdfHeaderRow(allRows[i])) {
        headerEnd = i + 1
      } else {
        break
      }
    }
    if (headerEnd === 0) {
      // P-3a tables: all-TD with no header row. Use first row as header.
      headerEnd = 1
    }

    const headerRows = allRows.slice(0, headerEnd)
    const dataRows = allRows.slice(headerEnd)
    if (dataRows.length === 0) continue

    const columns = buildTaggedPdfColumns(headerRows)
    if (columns.length === 0) continue

    // Determine dollar unit for this grid
    const gridUnit = columns._dollarUnit || fileUnit
    delete columns._dollarUnit

    // Build normalized rows
    const rows = []
    for (const row of dataRows.slice(0, MAX_DATA_ROWS)) {
      if (row.every(c => !c.text)) continue

      const cells = {}
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        const cell = i < row.length ? row[i] : null
        const val = cell ? cell.text : ''
        cells[col.code] = col.type === 'numeric' ? parseDollar(val) : val
      }

      // Row type from cell tag patterns
      const allTh = row.every(c => c.type === 'TH')
      const firstThRestTd = row[0]?.type === 'TH' && row.slice(1).some(c => c.type === 'TD')
      let rowType = 'data'
      if (allTh) rowType = 'subtotal'
      // Label cell has "Total" → mark as total
      const labelVal = cells.RowText || cells[columns[0]?.code] || ''
      if (/^\s*total\b/i.test(labelVal)) rowType = 'total'

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
      dollarUnit: gridUnit,
    })
  }

  if (grids.length === 0) return null
  return { metadata: { source: filename, sourceType: 'tagged-pdf' }, grids }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WORD XML PARSER
// ═══════════════════════════════════════════════════════════════════════════════
//
// Handles Office Open XML flat package files (<pkg:package> root).
// Only one Army file uses this: National Guard Army O&M Overview.xml
// Tables: w:tbl > w:tr > w:tc > w:p > w:r > w:t
// Bold cells (w:b) are treated as headers.

/**
 * Extract concatenated text from a Word table cell (w:tc).
 * Text is fragmented across multiple w:r (run) elements.
 */
function extractWordCellText(tcContent) {
  const texts = []
  for (const tMatch of tcContent.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gi)) {
    texts.push(tMatch[1])
  }
  return texts.join('').replace(/\s+/g, ' ').trim()
}

/** Check if a Word table cell contains bold formatting (w:b). */
function isWordBoldCell(tcContent) {
  // Check for <w:b/> or <w:b> in run properties (w:rPr)
  return /<w:b[\s/>]/i.test(tcContent)
}

/**
 * Parse a Word XML flat package file.
 * Extracts all tables with their rows and cell text.
 */
function parseWordXml(xmlText, filePath) {
  const filename = path.basename(filePath, path.extname(filePath))
  const grids = []

  // Find all w:tbl elements
  for (const tblMatch of xmlText.matchAll(/<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/gi)) {
    const tblContent = tblMatch[1]

    // Extract rows
    const allRows = []
    for (const trMatch of tblContent.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi)) {
      const trContent = trMatch[1]
      const cells = []

      for (const tcMatch of trContent.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi)) {
        const tcContent = tcMatch[1]
        const text = extractWordCellText(tcContent)
        const isBold = isWordBoldCell(tcContent)
        cells.push({ type: isBold ? 'TH' : 'TD', text })
      }

      if (cells.length > 0) allRows.push(cells)
    }

    if (allRows.length < 2) continue
    if (isNarrativeTable(allRows)) continue

    // Identify headers (same logic as TaggedPDF)
    let headerEnd = 0
    for (let i = 0; i < Math.min(4, allRows.length - 1); i++) {
      if (isTaggedPdfHeaderRow(allRows[i])) {
        headerEnd = i + 1
      } else {
        break
      }
    }
    if (headerEnd === 0) headerEnd = 1

    const headerRows = allRows.slice(0, headerEnd)
    const dataRows = allRows.slice(headerEnd)
    if (dataRows.length === 0) continue

    const columns = buildTaggedPdfColumns(headerRows)
    if (columns.length === 0) continue
    delete columns._dollarUnit

    const rows = []
    for (const row of dataRows.slice(0, MAX_DATA_ROWS)) {
      if (row.every(c => !c.text)) continue

      const cells = {}
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]
        const cell = i < row.length ? row[i] : null
        const val = cell ? cell.text : ''
        cells[col.code] = col.type === 'numeric' ? parseDollar(val) : val
      }

      const labelVal = cells.RowText || cells[columns[0]?.code] || ''
      let rowType = 'data'
      if (/^\s*total\b/i.test(labelVal)) rowType = 'total'
      if (row.every(c => c.type === 'TH')) rowType = 'subtotal'

      const hasData = Object.values(cells).some(v => v != null && v !== '')
      if (!hasData) continue

      rows.push({ code: null, type: rowType, cells })
    }

    if (rows.length === 0) continue

    grids.push({
      name: `Table ${grids.length + 1}`,
      tabPath: [`Table ${grids.length + 1}`],
      columns,
      rows,
      totalRows: dataRows.length,
      truncated: dataRows.length > MAX_DATA_ROWS,
      dollarUnit: 'thousands',
    })
  }

  if (grids.length === 0) return null
  return { metadata: { source: filename, sourceType: 'word-xml' }, grids }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  XML DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse an XML file, detecting format from content:
 *   1. Tagged PDF XML (<TaggedPDF-doc>)
 *   2. Word XML (<pkg:package> or mso-application)
 *   3. EAS XML (GeneratedOutput)
 */
function parseXml(filePath) {
  const xmlText = fs.readFileSync(filePath, 'utf8')
  const head = xmlText.slice(0, 1000)

  // Detect Tagged PDF XML
  if (head.includes('<TaggedPDF-doc>') || head.includes('<TaggedPDF-doc ')) {
    return parseTaggedPdfXml(xmlText, filePath)
  }

  // Detect Word XML (Office Open XML flat package)
  if (head.includes('pkg:package') || head.includes('mso-application') || head.includes('Word.Document')) {
    return parseWordXml(xmlText, filePath)
  }

  // Try EAS XML format
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

  const rootOutput = root.GeneratedOutput
  if (!rootOutput) return null

  const grids = []
  for (const { gridNode, tabPath } of walkGrids(rootOutput, [])) {
    const g = extractGrid(gridNode, tabPath)
    if (g.columns.length > 0 || g.rows.length > 0) grids.push(g)
  }

  return { metadata: root.Metadata || {}, grids }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXCEL PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellText: false, cellDates: false })
  const grids = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    if (rawRows.length < 2) continue

    // Find header row (first row with 4+ non-empty cells)
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
        type: /amount|quantity|\$/i.test(String(h).toLowerCase()) ? 'numeric' : 'text',
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
      dollarUnit: 'thousands',
    })
  }

  return { metadata: { source: path.basename(filePath) }, grids }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CATALOG METADATA
// ═══════════════════════════════════════════════════════════════════════════════

/** Shorten long phrases in document labels for cleaner dropdown display. */
function cleanDocLabel(label) {
  return label
    .replace(/Operation and Maintenance/gi, 'O&M')
    .replace(/Research,? Development,? Test(?:ing)? (?:and|&) Evaluation/gi, 'RDT&E')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Determine service, appropriation, and document labels from a relative file path.
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
    Navy: 'Navy',
  }
  const service = serviceMap[serviceDir] || serviceDir

  // Build document label from filename
  let docLabel = filename
    .replace(/\.(json|xml|xlsx?)$/i, '')
    .replace(/_/g, ' ')
    .replace(/^FY2026\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  docLabel = cleanDocLabel(docLabel)

  // Map directory names to display appropriation labels
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

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN PROCESSING LOOP
// ═══════════════════════════════════════════════════════════════════════════════

function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.log('No fy2026_budget/ directory found — skipping data processing.')
    console.log('Using existing public/data/ files (committed to git).')
    return
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const catalog = []
  const errors = []
  const stats = { json: 0, xml: 0, xlsx: 0, wordXml: 0, taggedPdf: 0, eas: 0, skipped: 0 }

  function walkDir(dir, relBase) {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
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
      if (ext === '.json') {
        parsed = parseEasJson(absPath)
        stats.json++
      } else if (ext === '.xml') {
        parsed = parseXml(absPath)
        stats.xml++
      } else if (ext === '.xlsx' || ext === '.xls') {
        parsed = parseExcel(absPath)
        stats.xlsx++
      }
    } catch (err) {
      console.error(`    ERROR: ${err.message}`)
      errors.push({ file: relPath, error: err.message })
      return
    }

    if (!parsed || !parsed.grids || parsed.grids.length === 0) {
      console.log(`    (no grids found, skipping)`)
      stats.skipped++
      return
    }

    // Track format stats
    if (parsed.metadata?.sourceType === 'tagged-pdf') stats.taggedPdf++
    else if (parsed.metadata?.sourceType === 'word-xml') stats.wordXml++
    else if (ext === '.json') stats.eas++

    const doc = {
      id,
      service,
      appropriation,
      document: docLabel,
      sourceFile: relPath,
      type: parsed.metadata?.sourceType || ext.replace('.', ''),
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
  console.log(`\n═══════════════════════════════════`)
  console.log(`  ${ok} documents written to public/data/`)
  console.log(`  Formats: ${stats.eas} EAS JSON, ${stats.taggedPdf} TaggedPDF, ${stats.wordXml} Word XML, ${stats.xlsx} Excel`)
  console.log(`  Skipped: ${stats.skipped} (no grids)`)
  if (fail > 0) {
    console.error(`  ${fail} errors:`)
    errors.forEach(e => console.error(`    ${e.file}: ${e.error}`))
  }
  console.log(`═══════════════════════════════════\n`)
}

main()
