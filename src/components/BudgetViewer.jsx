import React, { useState, useMemo, useEffect, useRef } from 'react'
import { COLORS } from '../colors'
import { BudgetBarChart, BudgetTreemap } from './Charts'

// ---------------------------------------------------------------------------
// Force Structure Display
// ---------------------------------------------------------------------------

/** Renders structured force structure data with bold headings and indented items. */
function ForceStructureDisplay({ data }) {
  // Handle legacy string format gracefully
  if (typeof data === 'string') {
    return <p style={{ margin: 0 }}>{data}</p>
  }
  if (!data) return null
  // data = { intro: string, sections: [{ heading, items }] }
  return (
    <>
      {data.intro && <p style={{ margin: '0 0 12px', whiteSpace: 'pre-line' }}>{data.intro}</p>}
      {data.sections.map((sec, i) => (
        <div key={i} style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>{sec.heading}</div>
          {sec.items.map((item, j) => (
            <div key={j} style={{ paddingLeft: 16 }}>{item}</div>
          ))}
        </div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clean grid columns: drop all-null columns, fix empty labels. */
function cleanColumns(columns, rows) {
  return columns
    .filter(c => c.code !== 'BudgActi')
    .filter(c => rows.some(r => r[c.code] != null))
    .map(c => ({
      code: c.code,
      text: c.text || (c.code === 'RowText' ? 'Description' : c.code),
    }))
}

/** Format a number with comma separators. */
function fmtDollar(val) {
  if (val == null) return '—'
  return val.toLocaleString('en-US')
}

/** Parse SAG number and name from O-1 RowText like "2020A   111  Maneuver Units". */
function parseSAGFromRowText(text) {
  const m = text.match(/\d{4}[A-Z]?\s+(\d{2,3}[A-Z]?)\s+(.+)/)
  if (m) return { sagNum: m[1], sagName: m[2].trim() }
  return { sagNum: '', sagName: text.trim() }
}

// Grid display names (friendly labels for grid codes)
const GRID_LABELS = {
  Op5PartOp32A: 'OP-32A Detail',
  OP5PART5: 'Part 5: FY Summary',
  OP53a: 'Part 3A: Program Elements',
  Op5Part3b: 'Part 3B: Changes',
  Op5Part3b2: 'Part 3B2: FY Comparison',
  OP5Part3C1: 'C. Reconciliation of Increases and Decreases',
  OP5Part6: 'Part 6: Outyears',
}

/** Friendly labels for top-level (appropriation-wide) exhibit grids */
const EXHIBIT_LABELS = {
  PBA19Summ: 'Appropriation Highlights (Summary)',
  PBA19BA01: 'Appropriation Highlights (BA 01)',
  PBA19BA02: 'Appropriation Highlights (BA 02)',
  PBA19BA03: 'Appropriation Highlights (BA 03)',
  PBA19BA04: 'Appropriation Highlights (BA 04)',
  PBA19PBA19ReadGrid: 'Appropriation Highlights (Strategic Readiness)',
  O1: 'O&M Funding by BA/AG/SAG',
  OP32: 'Price & Program Growth Summary',
  PB31D3C1: 'Summary of Funding Increases and Decreases',
  PB31ROMASummary: 'Personnel Summary',
  OP8P1_PY: 'Civilian Personnel (FY 2024 Actual)',
  OP8P1_CY: 'Civilian Personnel (FY 2025 Enacted)',
  OP8P1_BY1: 'Civilian Personnel (FY 2026 Request)',
  // Combined entries
  PBA19_COMBINED: 'Appropriation Highlights',
  OP8P1_COMBINED: 'Civilian Personnel',
}

/** Grid codes that get merged into a single PBA19 combined exhibit */
const PBA19_CODES = new Set(['PBA19BA01', 'PBA19BA02', 'PBA19BA03', 'PBA19BA04', 'PBA19Summ', 'PBA19PBA19ReadGrid'])
/** Desired row order for PBA19 combined exhibit */
const PBA19_ORDER = ['PBA19BA01', 'PBA19BA02', 'PBA19BA03', 'PBA19BA04', 'PBA19Summ', 'PBA19PBA19ReadGrid']
/** Row type overrides for PBA19 combined exhibit */
const PBA19_ROW_TYPES = { PBA19Summ: 'subtotal', PBA19PBA19ReadGrid: 'total' }

/** Grid codes that get merged into a single tabbed OP8P1 exhibit */
const OP8P1_CODES = new Set(['OP8P1_PY', 'OP8P1_CY', 'OP8P1_BY1'])

/** Vol 2: PME school abbreviation → full name */
const SCHOOL_NAMES = {
  CGSC: 'Command & General Staff College',
  AMSC: 'Army Management Staff College',
  USASMA: 'Sergeants Major Academy',
  USAWC: 'Army War College',
}

/** Vol 2: Manpower FY summary grids (merged into trend view) */
const MANPOWER_FY_CODES = new Set(['PB31QPYSumm', 'PB31QCYSumm', 'PB31QBY1Summ'])

/** Extract short abbreviation from parenthetical, e.g. "Operation & Maintenance, Army (OMA)" → "OMA" */
function shortApproLabel(text) {
  const m = text.match(/\(([^)]+)\)\s*$/)
  return m ? m[1] : (text.length > 20 ? text.slice(0, 20) + '...' : text)
}

/** Wrap the first occurrence of `query` in a highlighted span. */
function highlightMatch(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: '#fbbf2466', color: '#fbbf24', fontWeight: 700 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

/** Extract ~len chars around the first match of query in text. */
function snippetAround(text, query, len = 80) {
  if (!text || !query) return ''
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, len)
  const start = Math.max(0, idx - Math.floor(len / 2))
  const end = Math.min(text.length, start + len)
  let snippet = text.slice(start, end)
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  return snippet
}

/** Map gridCode to school abbreviation (handles PB24AFITPersSumm → AMSC) */
function schoolFromGridCode(code) {
  const m = code.match(/^PB24(.+?)(?:FinSumm|PerfCrit|PersSumm)$/)
  if (!m) return null
  const raw = m[1]
  if (raw === 'AFIT') return 'AMSC'  // PB24AFITPersSumm is AMSC's personnel grid
  return raw
}
/** Tab labels for OP8P1 combined exhibit */
const OP8P1_TABS = [
  { code: 'OP8P1_PY', label: 'FY 2024 Actual' },
  { code: 'OP8P1_CY', label: 'FY 2025 Enacted' },
  { code: 'OP8P1_BY1', label: 'FY 2026 Request' },
]

function exhibitLabel(g) {
  if (EXHIBIT_LABELS[g.gridCode]) return EXHIBIT_LABELS[g.gridCode]
  if (g.path && g.path.length > 0) return g.path[g.path.length - 1]
  return g.gridName
}

/**
 * Detect indentation level from RowText prefix patterns and row type.
 *
 * Row types:   total → header → subtotal → data
 * Text cues:   "1." sections, "a)" groups, "1)" items, "D1a." sub-items,
 *              "Total ..." subtotals that act as footers
 */
function detectIndentLevel(text, rowType) {
  if (!text) return 0
  if (rowType === 'total') return 0
  if (rowType === 'header') return 0
  const t = text.trimStart()

  if (rowType === 'subtotal') {
    // "Total ..." footer subtotals indent under their group
    if (/^Total\s/i.test(t)) return 2
    // "1. Congressional Adjustments" — numbered section header
    if (/^\d+\.\s/.test(t)) return 1
    // "a) Distributed Adjustments" — lettered group
    if (/^[a-z]\)\s/.test(t)) return 2
    // Other subtotals (category headers like "CIVILIAN PERSONNEL COMPENSATION")
    return 1
  }

  // Data rows
  // "1) Unjustified Growth" — numbered items
  if (/^\d+\)\s/.test(t)) return 3
  // "a) One-Time Costs" — lettered sub-items under a numbered item
  if (/^[a-z]\)\s/.test(t)) return 4
  // "D1a.", "R1b." — OP-8 style sub-items
  if (/^[DR]\d+[a-z]\./.test(t)) return 3
  // "D1.", "R1." — OP-8 style items
  if (/^[DR]\d+\./.test(t)) return 2
  // Default data indent (under a subtotal category)
  return 2
}

/**
 * Split Part I narrative text into paragraphs at ALL-CAPS headings.
 * Each heading is bolded, with the rest of the paragraph in normal weight.
 *
 * Heading pattern: consecutive ALL-CAPS words (may contain hyphens, &, /, parens)
 * followed by a dash separator (" - ", " – ", "- ").
 * Examples: "MANEUVER UNITS - ", "OFF-DUTY AND VOLUNTARY EDUCATION - ",
 *           "TREATY COMPLIANCE RETROGRADE (CLUSTER MUNITIONS AND LANDMINES) - "
 */
function splitNarrativeParagraphs(text) {
  // A "section" is ALL-CAPS words, possibly with hyphens (OFF-DUTY), parens (BOS), &, /
  // A heading can span multiple dash-separated sections: "RESET - OVERSEAS OPERATIONS COSTS"
  // The heading ends at a dash followed by body text (sentence-case word, not ALL-CAPS)
  const SEC = '(?:[A-Z][A-Z0-9/&\']+(?:-[A-Z0-9/&\']+)*)(?:[,\\s]+(?:[A-Z][A-Z0-9/&\']+(?:-[A-Z0-9/&\']+)*|\\([A-Z0-9/&\',\\s]+\\)))*'
  // Pattern 1: HEADING - body text (dash separator)
  const dashRe = new RegExp(
    '(' + SEC + '(?:\\s*[-\\u2013\\u2014]\\s+' + SEC + ')*)' +
    '\\s*[-\\u2013\\u2014]\\s(?=[A-Z][a-z]|[a-z]|\\(?\\d)',
    'g'
  )
  // Pattern 2: HEADING. Body text (period separator, e.g. "OFFENSIVE CYBER OPERATIONS. Resources...")
  // Requires 3+ uppercase words followed by period+space then sentence-case text
  const dotRe = new RegExp(
    '(' + SEC + '(?:\\s+' + SEC + ')*)' +
    '\\.\\s(?=[A-Z][a-z])',
    'g'
  )

  // Collect all heading matches with positions from both patterns
  const matches = []
  for (const m of text.matchAll(dashRe)) {
    const heading = m[1].trim()
    const letters = heading.replace(/[^A-Za-z]/g, '')
    if (letters.length < 2 || letters !== letters.toUpperCase()) continue
    matches.push({ heading, index: m.index, end: m.index + m[0].length })
  }
  for (const m of text.matchAll(dotRe)) {
    const heading = m[1].trim()
    const letters = heading.replace(/[^A-Za-z]/g, '')
    // Require at least 3 words to avoid false positives on abbreviations like "U.S."
    const wordCount = heading.split(/\s+/).filter(w => w.length > 1 || /^[A-Z]$/.test(w)).length
    if (letters.length < 4 || letters !== letters.toUpperCase() || wordCount < 3) continue
    // Skip if this overlaps with a dash match
    if (matches.some(dm => m.index >= dm.index && m.index < dm.end)) continue
    matches.push({ heading, index: m.index, end: m.index + m[0].length })
  }
  // Sort by position in the text
  matches.sort((a, b) => a.index - b.index)

  // Build paragraphs by splitting text at heading positions
  const paragraphs = []
  for (let i = 0; i < matches.length; i++) {
    const { heading, index, end } = matches[i]
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length

    // Text between previous heading's body end and this heading = leftover for previous para
    if (i === 0 && index > 0) {
      const preamble = text.slice(0, index).trim()
      if (preamble) paragraphs.push({ heading: '', body: preamble })
    }

    const body = text.slice(end, nextIndex).trim()
    paragraphs.push({ heading: heading + ' \u2014', body })
  }

  // If no headings matched, return text as-is
  if (matches.length === 0) {
    return <p style={{ margin: 0 }}>{text}</p>
  }

  return paragraphs.map((para, i) => (
    <p key={i} style={{ margin: i === 0 ? '0 0 10px' : '10px 0' }}>
      {para.heading && <strong>{para.heading} </strong>}
      {para.body}
    </p>
  ))
}

// ---------------------------------------------------------------------------
// SortableTable — reusable sortable table component
// ---------------------------------------------------------------------------

/** Infer row type from label text for auto-hierarchy grids (Financial Summary). */
function inferRowType(text) {
  if (!text) return 'data'
  const t = text.trim()
  if (/^Total Direct and/i.test(t)) return 'total'
  if (/^Total\s/i.test(t)) return 'subtotal'
  return 'data'
}

function SortableTable({ columns, rows, onRowClick, clickableRows, highlightTerm }) {
  const [sort, setSort] = useState({ col: null, dir: 'desc' })
  const scrolledRef = useRef(false)
  useEffect(() => { scrolledRef.current = false }, [highlightTerm])

  function toggleSort(colCode) {
    setSort(prev =>
      prev.col === colCode
        ? { col: colCode, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { col: colCode, dir: 'desc' }
    )
  }

  // Detect if this grid has hierarchical rows (total/subtotal types)
  const isHierarchical = useMemo(() => rows.some(r => r._rowType), [rows])

  const labelCol = columns[0]?.code

  // Auto-detect hierarchy for grids without _rowType but with "Total..." rows
  const autoHierarchy = useMemo(() => {
    if (isHierarchical) return false
    const lk = labelCol || 'RowText'
    return rows.some(r => /^Total\s/i.test((r[lk] || '').trim()))
  }, [isHierarchical, rows, labelCol])

  const sorted = useMemo(() => {
    // Don't sort hierarchical or auto-hierarchy grids — order is meaningful
    if ((isHierarchical || autoHierarchy) && !sort.col) return rows
    if (isHierarchical || autoHierarchy) return rows
    if (!sort.col) return rows
    return [...rows].sort((a, b) => {
      const av = a[sort.col]
      const bv = b[sort.col]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number')
        return sort.dir === 'asc' ? av - bv : bv - av
      return sort.dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [rows, sort, isHierarchical, autoHierarchy])

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              {columns.map(col => {
                const isSorted = sort.col === col.code
                const isLabel = col.code === labelCol
                return (
                  <th
                    key={col.code}
                    onClick={() => toggleSort(col.code)}
                    style={{
                      padding: '8px 12px',
                      background: COLORS.headerBg,
                      color: isSorted ? COLORS.accent : COLORS.textMuted,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      textAlign: isLabel ? 'left' : 'right',
                      borderBottom: `2px solid ${isSorted ? COLORS.accent : COLORS.border}`,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: isLabel ? 200 : 100,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {col.text}
                    {isSorted && (
                      <span style={{ marginLeft: 4, fontSize: 10 }}>
                        {sort.dir === 'desc' ? '\u25BC' : '\u25B2'}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => {
              let rowType = row._rowType || 'data'
              if (autoHierarchy && rowType === 'data') {
                rowType = inferRowType(row.RowText || row[labelCol])
              }
              const isTotal = rowType === 'total'
              const isSubtotal = rowType === 'subtotal'
              const isHeader = rowType === 'header'
              const indent = isHierarchical
                ? detectIndentLevel(row.RowText || row[labelCol], rowType)
                : autoHierarchy
                  ? (rowType === 'data' ? 1 : 0)
                  : 0

              const rowBg = isTotal ? COLORS.headerBg
                : isHeader ? COLORS.headerBg + 'cc'
                : isSubtotal ? COLORS.surface + 'cc'
                : 'transparent'
              const rowWeight = (isTotal || isHeader) ? 700 : isSubtotal ? 600 : 400
              const rowColor = isTotal ? COLORS.gold : isHeader ? COLORS.accent : COLORS.text
              const topBorder = (isTotal || isHeader) ? `2px solid ${COLORS.border}` : undefined

              const rowClickable = clickableRows && !isTotal && !isSubtotal

              // Highlight matching row from search result navigation
              const labelText = row.RowText || row[labelCol] || ''
              const isHighlighted = highlightTerm && labelText === highlightTerm

              // Subtotal rows with no numeric data render as spanning section headers
              const hasNoValues = (isSubtotal || isHeader) && columns.every(col => typeof row[col.code] !== 'number')

              const effectiveBg = isHighlighted ? 'rgba(251, 191, 36, 0.15)' : rowBg

              return (
                <tr
                  key={ri}
                  ref={isHighlighted && !scrolledRef.current ? (el) => {
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); scrolledRef.current = true }
                  } : undefined}
                  onClick={rowClickable && onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    cursor: rowClickable ? 'pointer' : 'default',
                    background: effectiveBg,
                    transition: 'background 0.1s',
                    borderTop: topBorder,
                    borderLeft: isHighlighted ? '3px solid #fbbf24' : undefined,
                  }}
                  onMouseEnter={e => { if (rowClickable) e.currentTarget.style.background = COLORS.headerBg + '88' }}
                  onMouseLeave={e => { if (rowClickable) e.currentTarget.style.background = effectiveBg }}
                >
                  {hasNoValues ? (
                    <td
                      colSpan={columns.length}
                      style={{
                        padding: '9px 12px',
                        paddingLeft: 12 + indent * 18,
                        borderBottom: `1px solid ${COLORS.border}44`,
                        color: COLORS.accent,
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {row.RowText || row[labelCol] || '\u2014'}
                    </td>
                  ) : columns.map(col => {
                    const val = row[col.code]
                    const isNum = typeof val === 'number'
                    const isLabel = col.code === labelCol
                    const paddingLeft = isLabel ? 12 + indent * 18 : 12

                    return (
                      <td
                        key={col.code}
                        style={{
                          padding: '7px 12px',
                          paddingLeft,
                          borderBottom: `1px solid ${COLORS.border}44`,
                          textAlign: isNum ? 'right' : 'left',
                          color: rowColor,
                          fontWeight: rowWeight,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: isNum ? 'nowrap' : 'normal',
                        }}
                      >
                        {isNum ? fmtDollar(val) : (val || '\u2014')}
                        {isLabel && rowClickable && (
                          <span style={{ color: COLORS.accent, marginLeft: 6, fontSize: 10 }}>▸</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '6px 12px',
        fontSize: 11,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        borderTop: `1px solid ${COLORS.border}44`,
      }}>
        {rows.length} rows
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BudgetViewer — main component with drill-down navigation
// ---------------------------------------------------------------------------

export default function BudgetViewer({ data, onBreadcrumbChange }) {
  const [view, setView] = useState({ level: 'summary' })
  const [activeGridCode, setActiveGridCode] = useState(null)

  // Parse data into structured views
  const parsed = useMemo(() => {
    const grids = data.grids || []

    // Find O-1 grid for BA/SAG summary
    const o1Grid = grids.find(g => g.gridCode === 'O1')

    // Build BA name map from OP-5 grid paths
    const baNames = {}
    for (const grid of grids) {
      if (grid.path[0] === 'OP-5 Exhibit' && grid.path.length >= 2 && grid.pathCodes.length > 0) {
        const sagCode = grid.pathCodes.find(c => c.startsWith('SAG'))
        if (sagCode) {
          const baNum = '0' + sagCode[3]
          if (!baNames[baNum]) baNames[baNum] = grid.path[1]
        }
      }
    }

    // Group O-1 rows by BA → AG → SAG (three levels)
    // BA derived from SAG number: SAG 1xx→BA 01, SAG 2xx→BA 02, etc.
    // AG comes from _ag field injected by the processor
    const baData = []
    if (o1Grid) {
      const byBA = {}
      for (const row of o1Grid.rows) {
        const { sagNum, sagName } = parseSAGFromRowText(row.RowText || '')
        if (!sagNum) continue
        const ba = '0' + sagNum[0]
        const agName = row._ag || 'Other'
        if (!byBA[ba]) byBA[ba] = { ba, name: baNames[ba] || `Budget Activity ${ba}`, Py: 0, Cy: 0, By1: 0, ags: {} }
        byBA[ba].Py += row.Py || 0
        byBA[ba].Cy += row.Cy || 0
        byBA[ba].By1 += row.By1 || 0

        if (!byBA[ba].ags[agName]) byBA[ba].ags[agName] = { name: agName, agNum: sagNum.substring(0, 2), Py: 0, Cy: 0, By1: 0, sags: [] }
        byBA[ba].ags[agName].Py += row.Py || 0
        byBA[ba].ags[agName].Cy += row.Cy || 0
        byBA[ba].ags[agName].By1 += row.By1 || 0
        byBA[ba].ags[agName].sags.push({ sagNum, sagName, Py: row.Py, Cy: row.Cy, By1: row.By1 })
      }
      for (const ba of Object.keys(byBA).sort()) {
        // Convert ags object to sorted array (preserve original order from data)
        byBA[ba].agList = Object.values(byBA[ba].ags)
        baData.push(byBA[ba])
      }
    }

    // Index OP-5 grids by SAG code
    const sagGrids = {}
    for (const grid of grids) {
      const sagCode = (grid.pathCodes || []).find(c => c.startsWith('SAG'))
      if (sagCode) {
        if (!sagGrids[sagCode]) sagGrids[sagCode] = []
        sagGrids[sagCode].push(grid)
      }
    }

    // Collect non-OP-5 grids (top-level exhibits)
    const rawTopGrids = grids.filter(g => g.path[0] !== 'OP-5 Exhibit' && g.rows.length > 0)

    // --- Combine PBA19 grids into one synthetic exhibit ---
    const pba19Grids = rawTopGrids.filter(g => PBA19_CODES.has(g.gridCode))
    const pba19ByCode = {}
    for (const g of pba19Grids) pba19ByCode[g.gridCode] = g

    let pba19Combined = null
    if (pba19Grids.length > 0) {
      // Use column schema from first available grid
      const refGrid = pba19Grids[0]
      const combinedRows = []
      for (const code of PBA19_ORDER) {
        const g = pba19ByCode[code]
        if (!g) continue
        for (const row of g.rows) {
          const merged = { ...row }
          if (PBA19_ROW_TYPES[code]) merged._rowType = PBA19_ROW_TYPES[code]
          combinedRows.push(merged)
        }
      }
      pba19Combined = {
        gridCode: 'PBA19_COMBINED',
        gridName: 'Appropriation Highlights',
        columns: refGrid.columns,
        rows: combinedRows,
        dollarUnit: refGrid.dollarUnit || 'thousands',
        path: refGrid.path,
        pathCodes: [],
        _type: 'combined',
      }
    }

    // --- Group OP8P1 grids for tabbed display ---
    const op8p1Grids = rawTopGrids.filter(g => OP8P1_CODES.has(g.gridCode))
    const op8p1ByCode = {}
    for (const g of op8p1Grids) op8p1ByCode[g.gridCode] = g

    let op8p1Combined = null
    if (op8p1Grids.length > 0) {
      op8p1Combined = {
        gridCode: 'OP8P1_COMBINED',
        gridName: 'Civilian Personnel',
        subGrids: op8p1ByCode,
        columns: op8p1Grids[0].columns,
        rows: op8p1Grids[0].rows,
        dollarUnit: op8p1Grids[0].dollarUnit || 'thousands',
        path: op8p1Grids[0].path,
        pathCodes: [],
        _type: 'tabbed',
      }
    }

    // Build final topGrids: standalone grids + combined entries
    let topGrids = rawTopGrids.filter(g => !PBA19_CODES.has(g.gridCode) && !OP8P1_CODES.has(g.gridCode))
    if (pba19Combined) topGrids.unshift(pba19Combined)
    if (op8p1Combined) topGrids.push(op8p1Combined)

    // ── Vol 2 data extraction ──────────────────────────────────────────────
    // A. School data from PB24*FinSumm grids
    const schools = {}
    for (const g of grids) {
      const m = g.gridCode.match(/^PB24(.+?)FinSumm$/)
      if (!m) continue
      const abbr = m[1] === 'AFIT' ? 'AMSC' : m[1]
      if (!SCHOOL_NAMES[abbr]) continue
      const totalRow = g.rows.find(r => /^Total Direct and Reimbursable/i.test(r.RowText || ''))
      if (totalRow) {
        schools[abbr] = {
          abbr,
          name: SCHOOL_NAMES[abbr],
          Py: totalRow.Py || 0,
          Cy: totalRow.Current || 0,  // FinSumm uses "Current" not "Cy"
          By1: totalRow.By1 || 0,
        }
      }
    }

    // B. Advisory data from PB15ProgData
    let advisory = null
    const advisoryGrid = grids.find(g => g.gridCode === 'PB15ProgData')
    if (advisoryGrid) {
      const totalRow = advisoryGrid.rows.find(r => r._rowType === 'subtotal' && /^TOTAL$/i.test((r.RowText || '').trim()))
      if (totalRow) {
        advisory = { Py: totalRow.Py || 0, Cy: totalRow.Cy || 0, By1: totalRow.By1 || 0 }
      }
    }

    // C. FTE summary from PB31QSumm (3 rows)
    let fteSummary = null
    const fteGrid = grids.find(g => g.gridCode === 'PB31QSumm')
    if (fteGrid && fteGrid.rows.length >= 3) {
      fteSummary = fteGrid.rows.map(r => ({ label: r.RowText, Tota: r.Tota || 0 }))
    }

    // D. Manpower trend — merge PB31QPYSumm + PB31QCYSumm + PB31QBY1Summ
    let manpowerTrend = []
    const pyGrid = grids.find(g => g.gridCode === 'PB31QPYSumm')
    const cyGrid = grids.find(g => g.gridCode === 'PB31QCYSumm')
    const byGrid = grids.find(g => g.gridCode === 'PB31QBY1Summ')
    if (pyGrid && cyGrid && byGrid) {
      const pySubtotals = pyGrid.rows.filter(r => r._rowType === 'subtotal')
      const cyMap = {}; for (const r of cyGrid.rows.filter(r => r._rowType === 'subtotal')) cyMap[r.RowText] = r
      const byMap = {}; for (const r of byGrid.rows.filter(r => r._rowType === 'subtotal')) byMap[r.RowText] = r
      for (const pyRow of pySubtotals) {
        const label = pyRow.RowText
        const cyRow = cyMap[label] || {}
        const byRow = byMap[label] || {}
        const pyTota = pyRow.Tota || 0
        const cyTota = cyRow.Tota || 0
        const byTota = byRow.Tota || 0
        if (pyTota === 0 && cyTota === 0 && byTota === 0) continue
        manpowerTrend.push({
          RowText: label,
          Py: pyTota,
          Cy: cyTota,
          By1: byTota,
          Change: byTota - cyTota,
          _rowType: 'subtotal',
        })
      }
    }

    // Filter manpower FY grids out of topGrids (shown in trend view instead)
    topGrids = topGrids.filter(g => !MANPOWER_FY_CODES.has(g.gridCode))

    // Build school-to-grid-index map for navigation
    const schoolGridMap = {}
    for (const abbr of Object.keys(SCHOOL_NAMES)) {
      schoolGridMap[abbr] = { fin: -1, perf: -1, pers: -1 }
    }
    topGrids.forEach((g, i) => {
      const abbr = schoolFromGridCode(g.gridCode)
      if (!abbr || !schoolGridMap[abbr]) return
      if (g.gridCode.endsWith('FinSumm')) schoolGridMap[abbr].fin = i
      else if (g.gridCode.endsWith('PerfCrit')) schoolGridMap[abbr].perf = i
      else if (g.gridCode.endsWith('PersSumm')) schoolGridMap[abbr].pers = i
    })

    // Find advisory and FTE summary grid indices
    const advisoryGridIndex = topGrids.findIndex(g => g.gridCode === 'PB15ProgData')
    const fteSummGridIndex = topGrids.findIndex(g => g.gridCode === 'PB31QFTESumm')
    const fteQSummGridIndex = topGrids.findIndex(g => g.gridCode === 'PB31QSumm')

    // Part 1 narratives keyed by SAG code
    const narratives = data.narratives || {}
    // Part 2 force structure summaries keyed by SAG code
    const forceStructure = data.forceStructure || {}

    return {
      o1Grid, baData, baNames, sagGrids, topGrids, narratives, forceStructure,
      schools, advisory, fteSummary, manpowerTrend,
      schoolGridMap, advisoryGridIndex, fteSummGridIndex, fteQSummGridIndex,
    }
  }, [data])

  // Navigation function for breadcrumb clicks
  const breadcrumbNav = (index) => {
    if (index <= 2) goToSummary()
    else if (index === 3) goToBA(view.ba)
    else if (index === 4 && view.level === 'sag') goToAG(view.ba, view.ag, view.agNum)
  }

  function goToManpowerTrend() {
    setView({ level: 'manpowerTrend' })
    setActiveGridCode(null)
  }

  // Update breadcrumb when view changes
  useEffect(() => {
    const base = [data.metadata.service, data.metadata.appropriation, data.metadata.source]
    if (view.level === 'ba' || view.level === 'ag' || view.level === 'sag') {
      base.push(`BA ${view.ba}: ${parsed.baNames[view.ba] || view.ba}`)
    }
    if (view.level === 'ag' || view.level === 'sag') {
      base.push(`AG ${view.agNum}: ${view.ag}`)
    }
    if (view.level === 'sag') {
      base.push(`SAG ${view.sagNum}: ${view.sagName}`)
    }
    if (view.level === 'exhibit') {
      const grid = parsed.topGrids[view.gridIndex]
      if (grid) base.push(grid.gridName)
    }
    if (view.level === 'manpowerTrend') {
      base.push('Manpower FTE Trend')
    }
    onBreadcrumbChange(base, breadcrumbNav)
  }, [view, data, parsed.baNames])

  // Navigation
  function goToSummary() {
    setView({ level: 'summary' })
    setActiveGridCode(null)
  }

  function goToBA(ba) {
    setView({ level: 'ba', ba })
    setActiveGridCode(null)
  }

  function goToAG(ba, ag, agNum) {
    setView({ level: 'ag', ba, ag, agNum })
    setActiveGridCode(null)
  }

  function goToSAG(ba, ag, agNum, sagNum, sagName) {
    setView({ level: 'sag', ba, ag, agNum, sagNum, sagName })
    setActiveGridCode(null)
  }

  // Panel style
  const panel = {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  }

  const sectionHeader = (title, dollarUnit) => (
    <div style={{
      padding: '10px 16px',
      background: COLORS.headerBg,
      borderBottom: `1px solid ${COLORS.border}`,
      fontSize: 13,
      fontWeight: 700,
      color: COLORS.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {title}
      {dollarUnit && (
        <span style={{ fontSize: 11, fontWeight: 400, color: COLORS.textMuted, fontStyle: 'italic' }}>
          {dollarUnit}
        </span>
      )}
    </div>
  )

  // Group topGrids by first path segment for exhibit index (used in summary view)
  const exhibitSections = useMemo(() => {
    const groups = {}
    parsed.topGrids.forEach((g, i) => {
      const section = (g.path && g.path.length > 0) ? g.path[0] : 'Other'
      if (!groups[section]) groups[section] = []
      groups[section].push({ grid: g, index: i })
    })
    return Object.entries(groups)
  }, [parsed.topGrids])

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  // Highlight info for flash-and-scroll after search result navigation
  const [highlightInfo, setHighlightInfo] = useState(null)
  useEffect(() => {
    if (!highlightInfo) return
    const timer = setTimeout(() => setHighlightInfo(null), 3000)
    return () => clearTimeout(timer)
  }, [highlightInfo])

  // Debounce search input (200ms)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (searchQuery.length < 2) {
      setDebouncedQuery('')
      return
    }
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 200)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery])

  // Click-outside closes dropdown
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Clear search when document changes
  useEffect(() => {
    setSearchQuery('')
    setDebouncedQuery('')
    setSearchOpen(false)
  }, [data])

  // Build search index from parsed data
  const searchIndex = useMemo(() => {
    const entries = []

    // Build SAG nav map: sagCode → { ba, ag, agNum, sagNum, sagName }
    const sagNavMap = {}
    for (const baEntry of parsed.baData) {
      for (const ag of baEntry.agList) {
        for (const sag of ag.sags) {
          const sagCode = 'SAG' + sag.sagNum
          sagNavMap[sagCode] = { ba: baEntry.ba, ag: ag.name, agNum: ag.agNum, sagNum: sag.sagNum, sagName: sag.sagName }
          // Index SAG name
          entries.push({
            type: 'SAG',
            label: `SAG ${sag.sagNum}: ${sag.sagName}`,
            context: `BA ${baEntry.ba} > AG ${ag.agNum}: ${ag.name}`,
            nav: { kind: 'sag', ...sagNavMap[sagCode] },
          })
        }
      }
    }

    // Index narratives
    for (const [sagCode, text] of Object.entries(parsed.narratives)) {
      const navInfo = sagNavMap[sagCode]
      if (!navInfo) continue
      entries.push({
        type: 'NARRATIVE',
        label: `SAG ${navInfo.sagNum}: ${navInfo.sagName}`,
        context: typeof text === 'string' ? text.slice(0, 200) : '',
        nav: { kind: 'sag', ...navInfo },
      })
    }

    // Index force structure
    for (const [sagCode, fsData] of Object.entries(parsed.forceStructure)) {
      const navInfo = sagNavMap[sagCode]
      if (!navInfo) continue
      let fsText = ''
      if (typeof fsData === 'string') {
        fsText = fsData.slice(0, 200)
      } else if (fsData) {
        const parts = []
        if (fsData.intro) parts.push(fsData.intro)
        for (const sec of (fsData.sections || [])) {
          parts.push(sec.heading)
          parts.push(...sec.items)
        }
        fsText = parts.join(' ').slice(0, 200)
      }
      entries.push({
        type: 'FORCE STR.',
        label: `SAG ${navInfo.sagNum}: ${navInfo.sagName}`,
        context: fsText,
        nav: { kind: 'sag', ...navInfo },
      })
    }

    // Index grid rows from top-level exhibits
    for (let gi = 0; gi < parsed.topGrids.length; gi++) {
      const g = parsed.topGrids[gi]
      const labelCol = g.columns.find(c => c.code === 'RowText' || c.code === 'BudgActiTitl' || c.code === 'AccoTitl' || c.code === 'BudgLineItemTitl')
      const colCode = labelCol ? labelCol.code : (g.columns[0] ? g.columns[0].code : null)
      if (!colCode) continue
      for (const row of g.rows) {
        const val = row[colCode]
        if (!val || typeof val !== 'string' || val.length < 3) continue
        entries.push({
          type: 'GRID ROW',
          label: val,
          context: exhibitLabel(g),
          nav: { kind: 'exhibit', gridIndex: gi },
        })
      }
    }

    // Index grid rows from SAG grids
    for (const [sagCode, sagGridList] of Object.entries(parsed.sagGrids)) {
      const navInfo = sagNavMap[sagCode]
      if (!navInfo) continue
      for (const g of sagGridList) {
        const labelCol = g.columns.find(c => c.code === 'RowText')
        const colCode = labelCol ? labelCol.code : (g.columns[0] ? g.columns[0].code : null)
        if (!colCode) continue
        for (const row of g.rows) {
          const val = row[colCode]
          if (!val || typeof val !== 'string' || val.length < 3) continue
          entries.push({
            type: 'GRID ROW',
            label: val,
            context: `SAG ${navInfo.sagNum}: ${navInfo.sagName} > ${GRID_LABELS[g.gridCode] || g.gridName}`,
            nav: { kind: 'sag', ...navInfo },
          })
        }
      }
    }

    return entries
  }, [parsed])

  // Compute search results
  const searchResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return { hits: [], overflow: false }
    const q = debouncedQuery.toLowerCase()
    const hits = []
    for (const entry of searchIndex) {
      if (hits.length >= 20) return { hits, overflow: true }
      if (entry.label.toLowerCase().includes(q) || entry.context.toLowerCase().includes(q)) {
        hits.push(entry)
      }
    }
    return { hits, overflow: false }
  }, [debouncedQuery, searchIndex])

  function navigateToResult(hit) {
    setSearchQuery('')
    setDebouncedQuery('')
    setSearchOpen(false)
    setHighlightInfo({ term: hit.label, type: hit.type })
    if (hit.nav.kind === 'sag') {
      goToSAG(hit.nav.ba, hit.nav.ag, hit.nav.agNum, hit.nav.sagNum, hit.nav.sagName)
    } else if (hit.nav.kind === 'exhibit') {
      setView({ level: 'exhibit', gridIndex: hit.nav.gridIndex })
      setActiveGridCode(null)
    }
  }

  // ── Render view content ──────────────────────────────────────────────────
  const tableHighlight = highlightInfo?.type === 'GRID ROW' ? highlightInfo.term : null
  let viewContent = null

  // ── Summary View ──────────────────────────────────────────────────────────
  if (view.level === 'summary') {
    const baCols = [
      { code: 'label', text: 'Budget Activity' },
      { code: 'Py', text: 'FY 2024 Actual' },
      { code: 'Cy', text: 'FY 2025 Enacted' },
      { code: 'By1', text: 'FY 2026 Request' },
    ]
    const baRows = parsed.baData.map(ba => ({
      label: `BA ${ba.ba}: ${ba.name}`,
      Py: Math.round(ba.Py / 1000),
      Cy: Math.round(ba.Cy / 1000),
      By1: Math.round(ba.By1 / 1000),
      _ba: ba.ba,
    }))
    // Grand total row
    const total = { label: 'TOTAL', Py: 0, Cy: 0, By1: 0, _rowType: 'total' }
    for (const ba of parsed.baData) { total.Py += ba.Py; total.Cy += ba.Cy; total.By1 += ba.By1 }
    total.Py = Math.round(total.Py / 1000); total.Cy = Math.round(total.Cy / 1000); total.By1 = Math.round(total.By1 / 1000)
    const baRowsWithTotal = [...baRows, total]

    const baChartData = parsed.baData.map(ba => ({
      name: `BA ${ba.ba}: ${ba.name}`, Py: ba.Py, Cy: ba.Cy, By1: ba.By1,
    }))

    viewContent = (
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* BA charts + summary table (only when O-1 grid exists) */}
        {parsed.baData.length > 0 && (
          <>
            {baChartData.length > 0 && (
              <div style={panel}>
                {sectionHeader('Budget Activity Overview')}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <BudgetBarChart data={baChartData} />
                  <BudgetTreemap data={baChartData} />
                </div>
              </div>
            )}

            <div style={panel}>
              {sectionHeader('Budget Activity Summary', '$ in millions')}
              <SortableTable
                columns={baCols}
                rows={baRowsWithTotal}
                clickableRows
                onRowClick={row => row._ba ? goToBA(row._ba) : undefined}
                highlightTerm={tableHighlight}
              />
            </div>
          </>
        )}

        {/* Vol 2 rich landing page (when no O-1 grid) */}
        {parsed.baData.length === 0 && parsed.topGrids.length > 0 && (() => {
          const hasSchools = Object.keys(parsed.schools).length > 0
          const schoolAbbrs = ['CGSC', 'AMSC', 'USASMA', 'USAWC']
          const schoolChartData = schoolAbbrs
            .filter(a => parsed.schools[a])
            .map(a => ({ name: a, Py: parsed.schools[a].Py, Cy: parsed.schools[a].Cy, By1: parsed.schools[a].By1 }))
          const manpowerChartData = parsed.manpowerTrend.filter(r => r.Py > 0 || r.Cy > 0 || r.By1 > 0)
            .map(r => ({ name: shortApproLabel(r.RowText), Py: r.Py, Cy: r.Cy, By1: r.By1 }))

          const metricBox = (label, value, color) => (
            <div style={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: color || COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
                {value != null ? fmtDollar(value) : '\u2014'}
              </div>
            </div>
          )

          const linkBtn = (label, gridIndex) => gridIndex >= 0 ? (
            <button
              onClick={() => { setView({ level: 'exhibit', gridIndex }); setActiveGridCode(null) }}
              style={{
                background: 'transparent', color: COLORS.accent, border: 'none',
                fontSize: 11, cursor: 'pointer', padding: '2px 0', textDecoration: 'underline',
              }}
            >{label}</button>
          ) : null

          return (
            <>
              {/* Panel A: Professional Military Education Schools */}
              {hasSchools && (
                <div style={panel}>
                  {sectionHeader('Professional Military Education Schools', '$ in thousands')}
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <BudgetBarChart data={schoolChartData} />
                    <BudgetTreemap data={schoolChartData} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                      {schoolAbbrs.filter(a => parsed.schools[a]).map(abbr => {
                        const s = parsed.schools[abbr]
                        const gm = parsed.schoolGridMap[abbr] || {}
                        const change = s.By1 - s.Cy
                        const pct = s.Cy ? ((change / s.Cy) * 100).toFixed(1) : '—'
                        return (
                          <div key={abbr} style={{
                            background: COLORS.headerBg, borderRadius: 6, padding: '12px 14px',
                            border: `1px solid ${COLORS.border}`,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{abbr}</div>
                            <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>{s.name}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.gold, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtDollar(s.By1)}
                            </div>
                            <div style={{ fontSize: 11, color: change >= 0 ? '#34d399' : '#f87171', marginBottom: 8 }}>
                              {change >= 0 ? '+' : ''}{fmtDollar(change)} ({pct}%) vs FY25
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {linkBtn('Financial', gm.fin)}
                              {linkBtn('Performance', gm.perf)}
                              {linkBtn('Personnel', gm.pers)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Panel B: Advisory and Assistance Services */}
              {parsed.advisory && (
                <div style={panel}>
                  {sectionHeader('Advisory and Assistance Services', '$ in thousands')}
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
                      {metricBox('FY 2024 Actual', parsed.advisory.Py, '#6366f1')}
                      {metricBox('FY 2025 Enacted', parsed.advisory.Cy, '#22d3ee')}
                      {metricBox('FY 2026 Request', parsed.advisory.By1, '#fbbf24')}
                    </div>
                    {parsed.advisoryGridIndex >= 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => { setView({ level: 'exhibit', gridIndex: parsed.advisoryGridIndex }); setActiveGridCode(null) }}
                          style={{
                            background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 4,
                            padding: '6px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >View Detail</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Panel C: Manpower Changes in FTEs */}
              {parsed.fteSummary && (
                <div style={panel}>
                  {sectionHeader('Manpower Changes in FTEs')}
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                      {parsed.fteSummary.map((r, i) => (
                        <div key={i} style={{ textAlign: 'center', flex: 1, minWidth: 100 }}>
                          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{r.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: ['#6366f1', '#22d3ee', '#fbbf24'][i], fontVariantNumeric: 'tabular-nums' }}>
                            {fmtDollar(r.Tota)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {manpowerChartData.length > 0 && (
                      <BudgetBarChart data={manpowerChartData} isFTE />
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      {parsed.manpowerTrend.length > 0 && (
                        <button
                          onClick={goToManpowerTrend}
                          style={{
                            background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 4,
                            padding: '6px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >View FTE Trend</button>
                      )}
                      {parsed.fteSummGridIndex >= 0 && (
                        <button
                          onClick={() => { setView({ level: 'exhibit', gridIndex: parsed.fteSummGridIndex }); setActiveGridCode(null) }}
                          style={{
                            background: COLORS.surface, color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 4,
                            padding: '6px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >FTE Adjustments</button>
                      )}
                      {parsed.fteQSummGridIndex >= 0 && (
                        <button
                          onClick={() => { setView({ level: 'exhibit', gridIndex: parsed.fteQSummGridIndex }); setActiveGridCode(null) }}
                          style={{
                            background: COLORS.surface, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 4,
                            padding: '6px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >FTE Summary Grid</button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Remaining exhibits not shown above */}
              {exhibitSections.filter(([section]) =>
                section !== 'Professional Military Education Schools' &&
                section !== 'Advisory and Assistance Services' &&
                section !== 'Manpower Changes in FTEs'
              ).map(([section, items]) => (
                <div key={section} style={panel}>
                  {sectionHeader(`${section} (${items.length} ${items.length === 1 ? 'exhibit' : 'exhibits'})`)}
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {items.map(({ grid: g, index: i }) => (
                        <button
                          key={i}
                          onClick={() => { setView({ level: 'exhibit', gridIndex: i }); setActiveGridCode(null) }}
                          style={{
                            background: COLORS.headerBg, color: COLORS.text,
                            border: `1px solid ${COLORS.border}`, borderRadius: 4,
                            padding: '6px 12px', fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          {g.gridName}
                          <span style={{ color: COLORS.textMuted, marginLeft: 6 }}>({g.rows.length} rows)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )
        })()}

        {/* Appropriation-level exhibits (flat list when BA data exists) */}
        {parsed.baData.length > 0 && parsed.topGrids.length > 0 && (
          <div style={panel}>
            {sectionHeader(`Appropriation-Level Exhibits (${parsed.topGrids.length})`)}
            <div style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {parsed.topGrids.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => { setView({ level: 'exhibit', gridIndex: i }); setActiveGridCode(null) }}
                    style={{
                      background: COLORS.headerBg,
                      color: COLORS.text,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 4,
                      padding: '6px 12px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {exhibitLabel(g)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Exhibit Grid View ─────────────────────────────────────────────────────
  else if (view.level === 'exhibit') {
    const grid = parsed.topGrids[view.gridIndex]
    if (!grid) { goToSummary() }
    else {
      const dollarLabel = grid.dollarUnit === 'millions' ? '$ in millions' : '$ in thousands'

      // Tabbed exhibit (OP8P1 Civilian Personnel)
      if (grid._type === 'tabbed') {
      const activeCode = activeGridCode && grid.subGrids[activeGridCode] ? activeGridCode : OP8P1_TABS[0].code
      const activeSubGrid = grid.subGrids[activeCode]
      const rows = activeSubGrid ? activeSubGrid.rows : []
      const cols = activeSubGrid ? cleanColumns(activeSubGrid.columns, rows) : []

      viewContent = (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {OP8P1_TABS.map(tab => {
              const subGrid = grid.subGrids[tab.code]
              if (!subGrid) return null
              const isActive = tab.code === activeCode
              return (
                <button
                  key={tab.code}
                  onClick={() => setActiveGridCode(tab.code)}
                  style={{
                    background: isActive ? COLORS.accent : COLORS.surface,
                    color: isActive ? '#fff' : COLORS.textMuted,
                    border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                    borderRadius: 4,
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {tab.label} ({subGrid.rows.length})
                </button>
              )
            })}
          </div>
          <div style={panel}>
            {sectionHeader(exhibitLabel(grid), dollarLabel)}
            <SortableTable columns={cols} rows={rows} highlightTerm={tableHighlight} />
          </div>
        </div>
      )
    } else {
      // Standard exhibit (combined PBA19 or standalone)
      const cols = cleanColumns(grid.columns, grid.rows)

      viewContent = (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={panel}>
            {sectionHeader(exhibitLabel(grid), dollarLabel)}
            <SortableTable columns={cols} rows={grid.rows} highlightTerm={tableHighlight} />
          </div>
        </div>
      )
    }
    }
  }

  // ── BA Detail View — shows Activity Groups ──────────────────────────────
  else if (view.level === 'ba') {
    const baEntry = parsed.baData.find(b => b.ba === view.ba)
    if (!baEntry) { goToSummary() }
    else {
      const agCols = [
        { code: 'label', text: 'Activity Group' },
        { code: 'Py', text: 'FY 2024 Actual' },
        { code: 'Cy', text: 'FY 2025 Enacted' },
        { code: 'By1', text: 'FY 2026 Request' },
      ]
      const agRows = baEntry.agList.map(ag => ({
      label: `AG ${ag.agNum}: ${ag.name}`,
      Py: Math.round(ag.Py / 1000),
      Cy: Math.round(ag.Cy / 1000),
      By1: Math.round(ag.By1 / 1000),
      _ag: ag.name,
      _agNum: ag.agNum,
    }))
    const agTotal = { label: `BA ${view.ba} TOTAL`, Py: Math.round(baEntry.Py / 1000), Cy: Math.round(baEntry.Cy / 1000), By1: Math.round(baEntry.By1 / 1000), _rowType: 'total' }
    const agRowsWithTotal = [...agRows, agTotal]

    const agChartData = baEntry.agList.map(ag => ({
      name: `AG ${ag.agNum}: ${ag.name}`, Py: ag.Py, Cy: ag.Cy, By1: ag.By1,
    }))

      viewContent = (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {agChartData.length > 0 && (
            <div style={panel}>
              {sectionHeader(`BA ${view.ba} — Activity Group Overview`)}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <BudgetBarChart data={agChartData} />
                <BudgetTreemap data={agChartData} />
              </div>
            </div>
          )}

          <div style={panel}>
            {sectionHeader(`BA ${view.ba}: ${baEntry.name} — Activity Groups`, '$ in millions')}
            <SortableTable
              columns={agCols}
              rows={agRowsWithTotal}
              clickableRows
              onRowClick={row => row._ag ? goToAG(view.ba, row._ag, row._agNum) : undefined}
              highlightTerm={tableHighlight}
            />
          </div>
        </div>
      )
    }
  }

  // ── AG Detail View — shows Sub-Activity Groups within an Activity Group ─
  else if (view.level === 'ag') {
    const baEntry = parsed.baData.find(b => b.ba === view.ba)
    if (!baEntry) { goToSummary() }
    const agEntry = baEntry ? baEntry.agList.find(ag => ag.name === view.ag) : null
    if (baEntry && !agEntry) { goToBA(view.ba) }

    if (agEntry) {
      const sagCols = [
        { code: 'label', text: 'Sub-Activity Group' },
        { code: 'Py', text: 'FY 2024 Actual' },
        { code: 'Cy', text: 'FY 2025 Enacted' },
        { code: 'By1', text: 'FY 2026 Request' },
      ]
      const sagRows = agEntry.sags.map(s => ({
        label: `SAG ${s.sagNum}: ${s.sagName}`,
        Py: s.Py,
        Cy: s.Cy,
        By1: s.By1,
        _sagNum: s.sagNum,
        _sagName: s.sagName,
      }))
      const sagTotal = { label: `${view.ag} TOTAL`, Py: agEntry.Py, Cy: agEntry.Cy, By1: agEntry.By1, _rowType: 'total' }
      const sagRowsWithTotal = [...sagRows, sagTotal]

      const sagChartData = agEntry.sags.map(s => ({
        name: `SAG ${s.sagNum}: ${s.sagName}`, Py: s.Py, Cy: s.Cy, By1: s.By1,
      }))

      viewContent = (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sagChartData.length > 0 && (
            <div style={panel}>
              {sectionHeader(`${view.ag} — SAG Overview`)}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <BudgetBarChart data={sagChartData} />
                <BudgetTreemap data={sagChartData} />
              </div>
            </div>
          )}

          <div style={panel}>
            {sectionHeader(`${view.ag} — Sub-Activity Groups`, '$ in thousands')}
            <SortableTable
              columns={sagCols}
              rows={sagRowsWithTotal}
              clickableRows
              onRowClick={row => row._sagNum ? goToSAG(view.ba, view.ag, view.agNum, row._sagNum, row._sagName) : undefined}
              highlightTerm={tableHighlight}
            />
          </div>
        </div>
      )
    }
  }

  // ── Manpower FTE Trend View ─────────────────────────────────────────────
  else if (view.level === 'manpowerTrend') {
    const trendCols = [
      { code: 'RowText', text: 'Appropriation' },
      { code: 'Py', text: 'FY 2024' },
      { code: 'Cy', text: 'FY 2025' },
      { code: 'By1', text: 'FY 2026' },
      { code: 'Change', text: 'Change' },
    ]
    const chartData = parsed.manpowerTrend
      .filter(r => r.Py > 0 || r.Cy > 0 || r.By1 > 0)
      .map(r => ({ name: shortApproLabel(r.RowText), Py: r.Py, Cy: r.Cy, By1: r.By1 }))

    viewContent = (
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {chartData.length > 0 && (
          <div style={panel}>
            {sectionHeader('Manpower FTE by Appropriation')}
            <div style={{ padding: 16 }}>
              <BudgetBarChart data={chartData} isFTE />
            </div>
          </div>
        )}
        <div style={panel}>
          {sectionHeader('Manpower FTE Trend — All Appropriations', 'Full-Time Equivalents')}
          <SortableTable columns={trendCols} rows={parsed.manpowerTrend} highlightTerm={tableHighlight} />
        </div>
      </div>
    )
  }

  // ── SAG Detail View ───────────────────────────────────────────────────────
  else if (view.level === 'sag') {
    const sagCode = 'SAG' + view.sagNum
    const grids = parsed.sagGrids[sagCode] || []

    // Part III grid codes — these get merged into a single combined tab
    const PART3_CODES = new Set(['OP53a', 'Op5Part3b', 'Op5Part3b2', 'OP5Part3C1'])

    // Separate Part III grids from the rest
    const part3Grids = grids.filter(g => PART3_CODES.has(g.gridCode))
    const otherGrids = grids.filter(g => !PART3_CODES.has(g.gridCode))

    // Build tab list: non-Part-III grids + one combined Part III entry (if any)
    const tabOrder = ['Op5PartOp32A', 'OP5PART5', 'PART3_COMBINED', 'OP5Part6']
    const tabs = []
    for (const g of otherGrids) {
      tabs.push({ id: g.gridCode, label: GRID_LABELS[g.gridCode] || g.gridName, grids: [g] })
    }
    if (part3Grids.length > 0) {
      // Sort Part III sub-grids in canonical order
      const p3Order = ['OP53a', 'Op5Part3b', 'Op5Part3b2', 'OP5Part3C1']
      const sorted = [...part3Grids].sort((a, b) => p3Order.indexOf(a.gridCode) - p3Order.indexOf(b.gridCode))
      const totalRows = sorted.reduce((n, g) => n + g.rows.length, 0)
      tabs.push({ id: 'PART3_COMBINED', label: `Part III: Financial Summary`, grids: sorted, rowCount: totalRows })
    }
    // Sort tabs by preferred order
    tabs.sort((a, b) => {
      const ai = tabOrder.indexOf(a.id)
      const bi = tabOrder.indexOf(b.id)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    // Default to first tab if no active
    const activeTab = activeGridCode
      ? tabs.find(t => t.id === activeGridCode) || tabs[0]
      : tabs[0]

    const narrative = parsed.narratives[sagCode]
    const forceStructureText = parsed.forceStructure[sagCode]

    if (grids.length === 0 && !narrative && !forceStructureText) {
      viewContent = (
        <div style={{ padding: '16px 20px' }}>
          <div style={{
            padding: '24px', background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, color: COLORS.textMuted, fontSize: 13, textAlign: 'center',
          }}>
            No detailed grids available for SAG {view.sagNum}: {view.sagName}
          </div>
        </div>
      )
    }

    else {
      viewContent = (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Part I & Part II side-by-side when both exist */}
          {(narrative || forceStructureText) && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {narrative && (
                <div
                  ref={highlightInfo?.type === 'NARRATIVE' ? (el) => {
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  } : undefined}
                  style={{
                    ...panel,
                    flex: 1,
                    minWidth: 0,
                    ...(highlightInfo?.type === 'NARRATIVE' ? { boxShadow: '0 0 0 2px #fbbf24' } : {}),
                  }}
                >
                  {sectionHeader('Part I: Description of Operations Financed')}
                  <div style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: COLORS.text,
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}>
                    {splitNarrativeParagraphs(narrative)}
                  </div>
                </div>
              )}
              {forceStructureText && (
                <div
                  ref={highlightInfo?.type === 'FORCE STR.' ? (el) => {
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  } : undefined}
                  style={{
                    ...panel,
                    flex: 1,
                    minWidth: 0,
                    ...(highlightInfo?.type === 'FORCE STR.' ? { boxShadow: '0 0 0 2px #fbbf24' } : {}),
                  }}
                >
                  {sectionHeader('Part II: Force Structure Summary')}
                  <div style={{
                    padding: '14px 16px',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: COLORS.text,
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}>
                    <ForceStructureDisplay data={forceStructureText} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid tabs */}
          {tabs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {tabs.map(tab => {
                const isActive = tab === activeTab
                const count = tab.rowCount != null ? tab.rowCount : tab.grids[0].rows.length
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveGridCode(tab.id)}
                    style={{
                      background: isActive ? COLORS.accent : COLORS.surface,
                      color: isActive ? '#fff' : COLORS.textMuted,
                      border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                      borderRadius: 4,
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Active tab content — render each grid in the tab as a separate table */}
          {activeTab && activeTab.grids.map(g => {
            const cols = cleanColumns(g.columns, g.rows)
            return (
              <div key={g.gridCode} style={panel}>
                {sectionHeader(GRID_LABELS[g.gridCode] || g.gridName, '$ in thousands')}
                <SortableTable columns={cols} rows={g.rows} highlightTerm={tableHighlight} />
              </div>
            )
          })}
        </div>
      )
    }
  }

  // ── Search bar + view content wrapper ──────────────────────────────────────
  return (
    <div>
      {/* Search bar */}
      <div ref={searchRef} style={{ padding: '12px 20px 0', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => { if (debouncedQuery.length >= 2) setSearchOpen(true) }}
            onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); e.target.blur() } }}
            placeholder="Search SAGs, narratives, grid rows..."
            style={{
              width: '100%',
              padding: '8px 32px 8px 12px',
              background: COLORS.bg,
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setDebouncedQuery(''); setSearchOpen(false) }}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: COLORS.textMuted,
                fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {searchOpen && debouncedQuery.length >= 2 && (
          <div style={{
            position: 'absolute', left: 20, right: 20, top: '100%', marginTop: 4,
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 200, maxHeight: 400, overflowY: 'auto',
          }}>
            {searchResults.hits.length === 0 && (
              <div style={{ padding: '16px', color: COLORS.textMuted, fontSize: 12, textAlign: 'center' }}>
                No results for "{debouncedQuery}"
              </div>
            )}
            {searchResults.hits.map((hit, i) => {
              const badgeColors = {
                'SAG': '#6366f1',
                'NARRATIVE': '#22d3ee',
                'FORCE STR.': '#34d399',
                'GRID ROW': '#f59e0b',
              }
              return (
                <div
                  key={i}
                  onClick={() => navigateToResult(hit)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer',
                    borderBottom: i < searchResults.hits.length - 1 ? `1px solid ${COLORS.border}44` : 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = COLORS.headerBg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: (badgeColors[hit.type] || '#888') + '22',
                      color: badgeColors[hit.type] || '#888',
                      letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>
                      {hit.type}
                    </span>
                    <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500 }}>
                      {highlightMatch(hit.label, debouncedQuery)}
                    </span>
                  </div>
                  {hit.context && (
                    <div style={{ fontSize: 11, color: COLORS.textMuted, paddingLeft: 0, marginTop: 2 }}>
                      {hit.label.toLowerCase().includes(debouncedQuery.toLowerCase())
                        ? hit.context.slice(0, 80) + (hit.context.length > 80 ? '...' : '')
                        : highlightMatch(snippetAround(hit.context, debouncedQuery), debouncedQuery)
                      }
                    </div>
                  )}
                </div>
              )
            })}
            {searchResults.overflow && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic' }}>
                Showing first 20 results — refine your search for more
              </div>
            )}
          </div>
        )}
      </div>

      {viewContent}
    </div>
  )
}
