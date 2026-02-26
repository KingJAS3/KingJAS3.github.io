/**
 * BudgetViewer.jsx — the main content area that shows a loaded document's data.
 *
 * A "document" here is one budget file (e.g. "CYBERCOM OP-5") that contains
 * one or more "grids" — each grid is a table with columns and rows of budget data.
 *
 * Layout:
 *   - Grid tab strip at the top (one button per grid, grouped by tabPath)
 *   - Chart panel showing the selected grid's data as a bar chart
 *   - Treemap below for proportional funding visualization
 *   - Data table at the bottom for raw values
 *
 * @param {{
 *   data: object,         — the loaded document from public/data/<id>.json
 *   breadcrumb: string[], — current nav path (to update when drilling in)
 *   onBreadcrumbUpdate: Function
 * }} props
 */
import React, { useState, useMemo } from 'react'
import { COLORS } from '../colors'
import { BudgetBarChart, BudgetTreemap, formatDollars } from './Charts'

// ── Which column codes represent each fiscal year ────────────────────────────
// We check these in order and use the first one found in the grid's columns.
const FY_COLUMNS = {
  fy2024: ['Py', 'FyPy'],
  fy2025: ['Cy', 'FyCy'],
  fy2026: ['By1', 'FyBy1', 'FyBy1InThou'],
}

/**
 * Given a grid's column list, find the first matching column code for each fiscal year.
 * Returns an object like { fy2024: 'Py', fy2025: 'Cy', fy2026: 'By1' }.
 * @param {Array} columns - grid.columns
 */
function detectFyColumns(columns) {
  const codes = new Set(columns.map(c => c.code))
  const result = {}
  for (const [fy, candidates] of Object.entries(FY_COLUMNS)) {
    result[fy] = candidates.find(c => codes.has(c)) || null
  }
  return result
}

/**
 * Find the "label" column — the text column that names each row.
 * For EAS files: 'RowText'. For Excel: first text-type column.
 * @param {Array} columns
 */
function detectLabelColumn(columns) {
  const labelCandidates = ['RowText', 'AccoTitl', 'BudgActiTitl', 'BudgLineItemTitl']
  for (const code of labelCandidates) {
    if (columns.find(c => c.code === code)) return code
  }
  // Fallback: first text-type column
  const textCol = columns.find(c => c.type === 'text')
  return textCol ? textCol.code : columns[0]?.code
}

/**
 * Group grids by their top-level tabPath segment.
 * e.g. grids with tabPath ['SAG Parts', 'Part 1'] and ['SAG Parts', 'Part 2']
 * both belong to the group 'SAG Parts'.
 *
 * Returns: Array<{ groupName: string, grids: Array }>
 * @param {Array} grids
 */
function groupGrids(grids) {
  const groups = new Map()
  for (const grid of grids) {
    const groupName = grid.tabPath[0] || 'Overview'
    if (!groups.has(groupName)) groups.set(groupName, [])
    groups.get(groupName).push(grid)
  }
  return Array.from(groups.entries()).map(([groupName, grids]) => ({ groupName, grids }))
}

export default function BudgetViewer({ data, breadcrumb, onBreadcrumbUpdate }) {
  // Which grid is currently being displayed
  const [activeGridIdx, setActiveGridIdx] = useState(0)
  // Which tab group is expanded (for documents with many grids)
  const [activeGroup, setActiveGroup] = useState(null)

  const grids = data.grids || []
  const activeGrid = grids[activeGridIdx] || null

  const gridGroups = useMemo(() => groupGrids(grids), [grids])

  // Pick the first group as default if none is selected
  const currentGroup = activeGroup ?? (gridGroups[0]?.groupName || null)

  // ── Detect which column holds FY2026 budget amounts ──────────────────────
  const fyColumns = useMemo(
    () => activeGrid ? detectFyColumns(activeGrid.columns) : {},
    [activeGrid]
  )
  const labelCol = useMemo(
    () => activeGrid ? detectLabelColumn(activeGrid.columns) : null,
    [activeGrid]
  )

  // ── Build chart data from the active grid ────────────────────────────────
  // Filter to data/subtotal rows that have the FY2026 column populated.
  // "Subtotal" and "total" rows are included so charts show rollup values.
  const chartRows = useMemo(() => {
    if (!activeGrid || !labelCol) return []
    const fy26 = fyColumns.fy2026
    return activeGrid.rows
      .filter(r => {
        if (!['data', 'subtotal', 'total'].includes(r.type)) return false
        if (fy26 && r.cells[fy26] == null) return false
        const label = r.cells[labelCol]
        return label && label !== ''
      })
      .slice(0, 30)  // cap at 30 bars so the chart stays readable
      .map(r => ({
        name: r.cells[labelCol] || '(unnamed)',
        fy2024: fyColumns.fy2024 ? r.cells[fyColumns.fy2024] : null,
        fy2025: fyColumns.fy2025 ? r.cells[fyColumns.fy2025] : null,
        fy2026: fy26 ? r.cells[fy26] : null,
        _rowType: r.type,
      }))
  }, [activeGrid, labelCol, fyColumns])

  // ── Build treemap data (FY2026 only, only positive values) ───────────────
  const treemapData = useMemo(() => {
    return chartRows
      .filter(r => r.fy2026 > 0)
      .map(r => ({ name: r.name, value: r.fy2026 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
  }, [chartRows])

  // ── Which bars to show in the bar chart (only FY cols that exist) ─────────
  const bars = useMemo(() => {
    const out = []
    if (fyColumns.fy2024) out.push({ key: 'fy2024', label: 'FY2024 Actual', color: COLORS.bars[1] })
    if (fyColumns.fy2025) out.push({ key: 'fy2025', label: 'FY2025 Enacted', color: COLORS.bars[0] })
    if (fyColumns.fy2026) out.push({ key: 'fy2026', label: 'FY2026 Request', color: COLORS.gold })
    return out
  }, [fyColumns])

  // ── Handle grid tab click ─────────────────────────────────────────────────
  function selectGrid(idx, grid) {
    setActiveGridIdx(idx)
    // Update the breadcrumb to reflect the new tab path
    const base = breadcrumb.slice(0, 3)  // service, appropriation, document
    const extra = grid.tabPath.filter(Boolean)
    onBreadcrumbUpdate([...base, ...extra])
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const panelStyle = {
    background: COLORS.navyMid,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  }

  const sectionHeaderStyle = {
    padding: '12px 20px',
    background: COLORS.navyLight,
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: COLORS.textDim,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Document summary strip ────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        padding: '12px 20px',
        background: COLORS.navyMid,
        borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
        alignItems: 'center',
      }}>
        <StatPill label="Service" value={data.service} />
        <StatPill label="Appropriation" value={data.appropriation} />
        <StatPill label="Document" value={data.document} />
        <StatPill label="Grids" value={grids.length} />
        {activeGrid?.truncated && (
          <span style={{ fontSize: 11, color: COLORS.gold, marginLeft: 'auto' }}>
            ⚠ Showing first {activeGrid.rows.length} of {activeGrid.totalRows} rows
          </span>
        )}
      </div>

      {/* ── Grid navigator (tab strip) ────────────────────────────── */}
      {grids.length > 1 && (
        <div style={{ ...panelStyle }}>
          <div style={sectionHeaderStyle}>
            Grids
            <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>
              ({grids.length} total)
            </span>
          </div>
          {/* Group tabs — one per tabPath[0] group */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px' }}>
            {gridGroups.map(({ groupName, grids: groupGrids }) => (
              <div key={groupName} style={{ display: 'contents' }}>
                {/* Sub-tabs within the group */}
                {groupGrids.map(grid => {
                  const idx = grids.indexOf(grid)
                  const isActive = idx === activeGridIdx
                  const subLabel = grid.tabPath.slice(1).join(' › ') || grid.name
                  return (
                    <button
                      key={idx}
                      onClick={() => selectGrid(idx, grid)}
                      style={{
                        background: isActive ? COLORS.accent : COLORS.navyLight,
                        color: isActive ? '#fff' : COLORS.textDim,
                        border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                        borderRadius: 4,
                        padding: '5px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={grid.tabPath.join(' › ') || grid.name}
                    >
                      {subLabel.length > 24 ? subLabel.slice(0, 24) + '…' : subLabel}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chart panels ─────────────────────────────────────────── */}
      {activeGrid && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>

          {/* Bar chart */}
          <div style={panelStyle}>
            <div style={sectionHeaderStyle}>
              Year-over-Year Comparison
              {activeGrid && (
                <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>
                  — {activeGrid.name}
                </span>
              )}
            </div>
            <div style={{ padding: '16px 8px 8px' }}>
              <BudgetBarChart
                data={chartRows}
                xKey="name"
                bars={bars}
                height={300}
              />
            </div>
          </div>

          {/* Treemap (FY2026 proportional view) */}
          {treemapData.length > 1 && (
            <div style={panelStyle}>
              <div style={sectionHeaderStyle}>
                FY2026 Request — Proportional View
              </div>
              <div style={{ padding: '16px 8px 8px' }}>
                <BudgetTreemap data={treemapData} height={300} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Data table ───────────────────────────────────────────── */}
      {activeGrid && (
        <div style={panelStyle}>
          <div style={sectionHeaderStyle}>
            Data Table
            <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>
              — {activeGrid.name} ({activeGrid.rows.length} rows)
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <DataTable grid={activeGrid} labelCol={labelCol} fyColumns={fyColumns} />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A scrollable data table that renders one grid's rows and columns.
 * Dollar amounts are formatted; text is left-aligned.
 *
 * We highlight "total" rows gold and "subtotal" rows slightly brighter
 * so the hierarchy is visually clear.
 *
 * @param {{ grid: object, labelCol: string, fyColumns: object }} props
 */
function DataTable({ grid, labelCol, fyColumns }) {
  const { columns, rows } = grid

  // Show a curated column order: label first, then fiscal year columns, then others.
  const fySet = new Set(Object.values(fyColumns).filter(Boolean))
  const orderedCols = [
    ...columns.filter(c => c.code === labelCol),
    ...columns.filter(c => fySet.has(c.code) && c.code !== labelCol),
    ...columns.filter(c => !fySet.has(c.code) && c.code !== labelCol && c.type !== 'text'),
    ...columns.filter(c => !fySet.has(c.code) && c.code !== labelCol && c.type === 'text'),
  ].filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i) // dedupe

  const thStyle = {
    padding: '8px 12px',
    background: COLORS.navyLight,
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textAlign: 'right',
    borderBottom: `1px solid ${COLORS.border}`,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
  }

  const thLabelStyle = { ...thStyle, textAlign: 'left', minWidth: 160 }

  function rowBg(type) {
    if (type === 'total') return COLORS.gold + '18'
    if (type === 'subtotal') return COLORS.navyLight + 'cc'
    return 'transparent'
  }

  function rowColor(type) {
    if (type === 'total') return COLORS.gold
    return COLORS.text
  }

  return (
    <table style={{
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: 12,
    }}>
      <thead>
        <tr>
          {orderedCols.map(col => (
            <th key={col.code} style={col.code === labelCol ? thLabelStyle : thStyle}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: rowBg(row.type) }}>
            {orderedCols.map(col => {
              const val = row.cells[col.code]
              const isDollar = typeof val === 'number'
              return (
                <td
                  key={col.code}
                  style={{
                    padding: '6px 12px',
                    borderBottom: `1px solid ${COLORS.border}22`,
                    textAlign: isDollar ? 'right' : 'left',
                    color: isDollar ? rowColor(row.type) : COLORS.text,
                    fontWeight: row.type === 'total' ? 700 : row.type === 'subtotal' ? 600 : 400,
                    fontVariantNumeric: 'tabular-nums', // numbers align by decimal point
                    whiteSpace: isDollar ? 'nowrap' : 'normal',
                    // Indent the label column based on row type to show hierarchy
                    paddingLeft: col.code === labelCol
                      ? (row.type === 'total' ? 12 : row.type === 'subtotal' ? 20 : 28)
                      : 12,
                  }}
                >
                  {isDollar ? formatDollars(val) : (val ?? '—')}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * A small label+value badge used in the document summary strip.
 * @param {{ label: string, value: string|number }} props
 */
function StatPill({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}
