import React, { useState, useMemo, useEffect } from 'react'
import { COLORS } from '../colors'
import { BudgetBarChart, BudgetTreemap } from './Charts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  O1: 'O&M Funding by BA/AG/SAG',
  OP32: 'Price & Program Growth Summary',
  PB31D3C1: 'Summary of Funding Increases and Decreases',
  PB31ROMASummary: 'Personnel Summary',
  OP8P1_PY: 'Civilian Personnel (FY 2024 Actual)',
  OP8P1_CY: 'Civilian Personnel (FY 2025 Enacted)',
  OP8P1_BY1: 'Civilian Personnel (FY 2026 Request)',
}

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

// ---------------------------------------------------------------------------
// SortableTable — reusable sortable table component
// ---------------------------------------------------------------------------

function SortableTable({ columns, rows, onRowClick, dollarUnit, clickableRows }) {
  const [sort, setSort] = useState({ col: null, dir: 'desc' })

  function toggleSort(colCode) {
    setSort(prev =>
      prev.col === colCode
        ? { col: colCode, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { col: colCode, dir: 'desc' }
    )
  }

  // Detect if this grid has hierarchical rows (total/subtotal types)
  const isHierarchical = useMemo(() => rows.some(r => r._rowType), [rows])

  const sorted = useMemo(() => {
    // Don't sort hierarchical grids — order is meaningful
    if (isHierarchical && !sort.col) return rows
    if (isHierarchical) return rows // preserve hierarchy even when sort requested
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
  }, [rows, sort, isHierarchical])

  const labelCol = columns[0]?.code

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
              const rowType = row._rowType || 'data'
              const isTotal = rowType === 'total'
              const isSubtotal = rowType === 'subtotal'
              const isHeader = rowType === 'header'
              const indent = isHierarchical ? detectIndentLevel(row.RowText || row[labelCol], rowType) : 0

              const rowBg = isTotal ? COLORS.headerBg
                : isHeader ? COLORS.headerBg + 'cc'
                : isSubtotal ? COLORS.surface + 'cc'
                : 'transparent'
              const rowWeight = (isTotal || isHeader) ? 700 : isSubtotal ? 600 : 400
              const rowColor = isTotal ? COLORS.gold : isHeader ? COLORS.accent : COLORS.text
              const topBorder = (isTotal || isHeader) ? `2px solid ${COLORS.border}` : undefined

              return (
                <tr
                  key={ri}
                  onClick={clickableRows && onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    cursor: clickableRows ? 'pointer' : 'default',
                    background: rowBg,
                    transition: 'background 0.1s',
                    borderTop: topBorder,
                  }}
                  onMouseEnter={e => { if (clickableRows) e.currentTarget.style.background = COLORS.headerBg + '88' }}
                  onMouseLeave={e => { if (clickableRows) e.currentTarget.style.background = rowBg }}
                >
                  {columns.map(col => {
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
                        {isLabel && clickableRows && (
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
        {dollarUnit || '$ in thousands'} &middot; {rows.length} rows
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

        if (!byBA[ba].ags[agName]) byBA[ba].ags[agName] = { name: agName, Py: 0, Cy: 0, By1: 0, sags: [] }
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
    const topGrids = grids.filter(g => g.path[0] !== 'OP-5 Exhibit' && g.rows.length > 0)

    return { o1Grid, baData, baNames, sagGrids, topGrids }
  }, [data])

  // Navigation function for breadcrumb clicks
  const breadcrumbNav = (index) => {
    if (index <= 2) goToSummary()
    else if (index === 3) goToBA(view.ba)
    else if (index === 4 && view.level === 'sag') goToAG(view.ba, view.ag)
  }

  // Update breadcrumb when view changes
  useEffect(() => {
    const base = [data.metadata.service, data.metadata.appropriation, data.metadata.source]
    if (view.level === 'ba' || view.level === 'ag' || view.level === 'sag') {
      base.push(`BA ${view.ba}: ${parsed.baNames[view.ba] || view.ba}`)
    }
    if (view.level === 'ag' || view.level === 'sag') {
      base.push(view.ag)
    }
    if (view.level === 'sag') {
      base.push(`SAG ${view.sagNum}: ${view.sagName}`)
    }
    if (view.level === 'exhibit') {
      const grid = parsed.topGrids[view.gridIndex]
      if (grid) base.push(grid.gridName)
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

  function goToAG(ba, ag) {
    setView({ level: 'ag', ba, ag })
    setActiveGridCode(null)
  }

  function goToSAG(ba, ag, sagNum, sagName) {
    setView({ level: 'sag', ba, ag, sagNum, sagName })
    setActiveGridCode(null)
  }

  // Panel style
  const panel = {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  }

  const sectionHeader = (title) => (
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
    </div>
  )

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
      Py: ba.Py,
      Cy: ba.Cy,
      By1: ba.By1,
      _ba: ba.ba,
    }))
    // Grand total row
    const total = { label: 'TOTAL', Py: 0, Cy: 0, By1: 0 }
    for (const ba of parsed.baData) { total.Py += ba.Py; total.Cy += ba.Cy; total.By1 += ba.By1 }

    const baChartData = parsed.baData.map(ba => ({
      name: `BA ${ba.ba}: ${ba.name}`, Py: ba.Py, Cy: ba.Cy, By1: ba.By1,
    }))

    return (
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          {sectionHeader('Budget Activity Summary')}
          <SortableTable
            columns={baCols}
            rows={baRows}
            clickableRows
            onRowClick={row => goToBA(row._ba)}
            dollarUnit="$ in thousands"
          />
          {/* Grand total */}
          <div style={{
            display: 'flex', padding: '8px 12px', fontWeight: 700, fontSize: 12,
            background: COLORS.headerBg, borderTop: `2px solid ${COLORS.accent}`,
            color: COLORS.gold,
          }}>
            <span style={{ flex: 1, minWidth: 200 }}>TOTAL</span>
            {[total.Py, total.Cy, total.By1].map((v, i) => (
              <span key={i} style={{ minWidth: 100, textAlign: 'right', padding: '0 12px', fontVariantNumeric: 'tabular-nums' }}>
                {fmtDollar(v)}
              </span>
            ))}
          </div>
        </div>

        {/* Appropriation-level exhibits */}
        {parsed.topGrids.length > 0 && (
          <div style={panel}>
            {sectionHeader(`Appropriation-Level Exhibits (${parsed.topGrids.length})`)}
            <div style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {parsed.topGrids.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setView({ level: 'exhibit', gridIndex: i })}
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
  if (view.level === 'exhibit') {
    const grid = parsed.topGrids[view.gridIndex]
    if (!grid) { goToSummary(); return null }

    const cols = grid.columns.map(c => ({
      code: c.code,
      text: c.text || c.code,
    }))

    return (
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={panel}>
          {sectionHeader(exhibitLabel(grid))}
          <SortableTable columns={cols} rows={grid.rows} dollarUnit="$ in thousands" />
        </div>
      </div>
    )
  }

  // ── BA Detail View — shows Activity Groups ──────────────────────────────
  if (view.level === 'ba') {
    const baEntry = parsed.baData.find(b => b.ba === view.ba)
    if (!baEntry) { goToSummary(); return null }

    const agCols = [
      { code: 'label', text: 'Activity Group' },
      { code: 'Py', text: 'FY 2024 Actual' },
      { code: 'Cy', text: 'FY 2025 Enacted' },
      { code: 'By1', text: 'FY 2026 Request' },
    ]
    const agRows = baEntry.agList.map(ag => ({
      label: ag.name,
      Py: ag.Py,
      Cy: ag.Cy,
      By1: ag.By1,
      _ag: ag.name,
    }))

    const agChartData = baEntry.agList.map(ag => ({
      name: ag.name, Py: ag.Py, Cy: ag.Cy, By1: ag.By1,
    }))

    return (
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
          {sectionHeader(`BA ${view.ba}: ${baEntry.name} — Activity Groups`)}
          <SortableTable
            columns={agCols}
            rows={agRows}
            clickableRows
            onRowClick={row => goToAG(view.ba, row._ag)}
            dollarUnit="$ in thousands"
          />
          {/* BA total */}
          <div style={{
            display: 'flex', padding: '8px 12px', fontWeight: 700, fontSize: 12,
            background: COLORS.headerBg, borderTop: `2px solid ${COLORS.accent}`,
            color: COLORS.gold,
          }}>
            <span style={{ flex: 1, minWidth: 200 }}>BA {view.ba} TOTAL</span>
            {[baEntry.Py, baEntry.Cy, baEntry.By1].map((v, i) => (
              <span key={i} style={{ minWidth: 100, textAlign: 'right', padding: '0 12px', fontVariantNumeric: 'tabular-nums' }}>
                {fmtDollar(v)}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── AG Detail View — shows Sub-Activity Groups within an Activity Group ─
  if (view.level === 'ag') {
    const baEntry = parsed.baData.find(b => b.ba === view.ba)
    if (!baEntry) { goToSummary(); return null }
    const agEntry = baEntry.agList.find(ag => ag.name === view.ag)
    if (!agEntry) { goToBA(view.ba); return null }

    const sagCols = [
      { code: 'label', text: 'Sub-Activity Group' },
      { code: 'Py', text: 'FY 2024 Actual' },
      { code: 'Cy', text: 'FY 2025 Enacted' },
      { code: 'By1', text: 'FY 2026 Request' },
    ]
    const sagRows = agEntry.sags.map(s => ({
      label: `${s.sagNum} \u2014 ${s.sagName}`,
      Py: s.Py,
      Cy: s.Cy,
      By1: s.By1,
      _sagNum: s.sagNum,
      _sagName: s.sagName,
    }))

    const sagChartData = agEntry.sags.map(s => ({
      name: `${s.sagNum} — ${s.sagName}`, Py: s.Py, Cy: s.Cy, By1: s.By1,
    }))

    return (
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
          {sectionHeader(`${view.ag} — Sub-Activity Groups`)}
          <SortableTable
            columns={sagCols}
            rows={sagRows}
            clickableRows
            onRowClick={row => goToSAG(view.ba, view.ag, row._sagNum, row._sagName)}
            dollarUnit="$ in thousands"
          />
          {/* AG total */}
          <div style={{
            display: 'flex', padding: '8px 12px', fontWeight: 700, fontSize: 12,
            background: COLORS.headerBg, borderTop: `2px solid ${COLORS.accent}`,
            color: COLORS.gold,
          }}>
            <span style={{ flex: 1, minWidth: 200 }}>{view.ag} TOTAL</span>
            {[agEntry.Py, agEntry.Cy, agEntry.By1].map((v, i) => (
              <span key={i} style={{ minWidth: 100, textAlign: 'right', padding: '0 12px', fontVariantNumeric: 'tabular-nums' }}>
                {fmtDollar(v)}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── SAG Detail View ───────────────────────────────────────────────────────
  if (view.level === 'sag') {
    const sagCode = 'SAG' + view.sagNum
    const grids = parsed.sagGrids[sagCode] || []

    // Preferred order for grid tabs
    const order = ['Op5PartOp32A', 'OP5PART5', 'Op5Part3b', 'Op5Part3b2', 'OP5Part3C1', 'OP5Part6']
    const sortedGrids = [...grids].sort((a, b) => {
      const ai = order.indexOf(a.gridCode)
      const bi = order.indexOf(b.gridCode)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    // Default to first grid if no active
    const active = activeGridCode
      ? sortedGrids.find(g => g.gridCode === activeGridCode) || sortedGrids[0]
      : sortedGrids[0]

    if (grids.length === 0) {
      return (
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

    const activeCols = active.columns.map(c => ({
      code: c.code,
      text: c.text || c.code,
    }))

    return (
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Grid tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {sortedGrids.map(g => {
            const isActive = g === active
            const label = GRID_LABELS[g.gridCode] || g.gridName
            return (
              <button
                key={g.gridCode}
                onClick={() => setActiveGridCode(g.gridCode)}
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
                {label} ({g.rows.length})
              </button>
            )
          })}
        </div>

        {/* Active grid table */}
        {active && (
          <div style={panel}>
            {sectionHeader(GRID_LABELS[active.gridCode] || active.gridName)}
            <SortableTable columns={activeCols} rows={active.rows} dollarUnit="$ in thousands" />
          </div>
        )}
      </div>
    )
  }

  return null
}
