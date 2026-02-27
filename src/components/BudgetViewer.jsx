/**
 * BudgetViewer.jsx — table-only display for a loaded budget document.
 *
 * A document contains one or more "grids" — each is a table with
 * columns and rows of budget data.  When there are multiple grids,
 * a compact section-picker appears at the top.
 *
 * Features:
 *   - Sortable column headers (click to sort ascending/descending)
 *   - Dollar amounts displayed with commas (values are already in thousands)
 *   - "$ in thousands" note shown on the table header
 *   - Total / subtotal rows highlighted for visual hierarchy
 *   - Breadcrumb updated when switching sections
 */
import React, { useState, useMemo } from 'react'
import { COLORS } from '../colors'

// ── Formatting ────────────────────────────────────────────────────────────────

/** Format a number (already in thousands) with comma separators. */
function fmtK(val) {
  if (val == null) return '—'
  return val.toLocaleString('en-US')
}

// ── Column detection ──────────────────────────────────────────────────────────

/** Find the text column that names each row. */
function detectLabelColumn(columns) {
  const candidates = ['RowText', 'AccoTitl', 'BudgActiTitl', 'BudgLineItemTitl']
  for (const code of candidates) {
    if (columns.find(c => c.code === code)) return code
  }
  return columns.find(c => c.type === 'text')?.code ?? columns[0]?.code
}

/**
 * Build the display-ordered column list for a grid.
 * Order: label column → numeric columns → any remaining text columns.
 */
function orderedColumns(columns, labelCol) {
  const seen = new Set()
  const add = (arr) => arr.filter(c => {
    if (seen.has(c.code)) return false
    seen.add(c.code)
    return true
  })
  return [
    ...add(columns.filter(c => c.code === labelCol)),
    ...add(columns.filter(c => c.type === 'numeric')),
    ...add(columns.filter(c => c.type !== 'numeric' && c.code !== labelCol)),
  ]
}

/** Short label for a grid's tab button — last meaningful tabPath segment or grid name. */
function gridButtonLabel(grid) {
  const segments = grid.tabPath.filter(p => p && !/^(tabs?)$/i.test(p))
  const raw = segments[segments.length - 1] || grid.name || 'Grid'
  return raw.length > 32 ? raw.slice(0, 32) + '…' : raw
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BudgetViewer({ data, breadcrumb, onBreadcrumbUpdate }) {
  const grids = data.grids || []
  const [activeIdx, setActiveIdx] = useState(0)
  const [sort, setSort] = useState({ col: null, dir: 'desc' })

  const grid = grids[activeIdx] ?? null
  const labelCol = useMemo(() => grid ? detectLabelColumn(grid.columns) : null, [grid])
  const dispCols = useMemo(() => grid ? orderedColumns(grid.columns, labelCol) : [], [grid, labelCol])

  // Sorted rows — only re-computed when sort spec or grid changes
  const sortedRows = useMemo(() => {
    if (!grid) return []
    if (!sort.col) return grid.rows
    return [...grid.rows].sort((a, b) => {
      const av = a.cells[sort.col]
      const bv = b.cells[sort.col]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number')
        return sort.dir === 'asc' ? av - bv : bv - av
      return sort.dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [grid, sort])

  function selectGrid(idx) {
    setActiveIdx(idx)
    setSort({ col: null, dir: 'desc' })
    const g = grids[idx]
    const base = breadcrumb.slice(0, 3)
    const extra = g.tabPath.filter(Boolean)
    onBreadcrumbUpdate([...base, ...extra])
  }

  function toggleSort(colCode) {
    setSort(prev =>
      prev.col === colCode
        ? { col: colCode, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { col: colCode, dir: 'desc' }
    )
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const panel = {
    background: COLORS.navyMid,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    overflow: 'hidden',
  }

  const sectionHdr = {
    padding: '10px 20px',
    background: COLORS.navyLight,
    borderBottom: `1px solid ${COLORS.border}`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: COLORS.textDim,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Document info strip ──────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        padding: '12px 20px',
        background: COLORS.navyMid,
        borderRadius: 8,
        border: `1px solid ${COLORS.border}`,
        alignItems: 'center',
      }}>
        <MetaPill label="Service"       value={data.service} />
        <MetaPill label="Appropriation" value={data.appropriation} />
        <MetaPill label="Document"      value={data.document} />
        <MetaPill label="Sections"      value={grids.length} />
        {grid?.truncated && (
          <span style={{ fontSize: 11, color: COLORS.gold, marginLeft: 'auto' }}>
            ⚠ Showing first {grid.rows.length} of {grid.totalRows} rows
          </span>
        )}
      </div>

      {/* ── Section / grid picker ────────────────────────────────────── */}
      {grids.length > 1 && (
        <div style={panel}>
          <div style={sectionHdr}>
            Sections
            <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>({grids.length})</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px' }}>
            {grids.map((g, i) => {
              const isActive = i === activeIdx
              return (
                <button
                  key={i}
                  onClick={() => selectGrid(i)}
                  title={g.tabPath.join(' › ') || g.name}
                  style={{
                    background: isActive ? COLORS.accent : COLORS.navyLight,
                    color: isActive ? '#fff' : COLORS.textDim,
                    border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                    borderRadius: 4,
                    padding: '5px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  {gridButtonLabel(g)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Data table ───────────────────────────────────────────────── */}
      {grid && (
        <div style={panel}>
          {/* Table header bar */}
          <div style={{
            ...sectionHdr,
            justifyContent: 'space-between',
            textTransform: 'none',
            letterSpacing: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {grid.name}
              <span style={{ fontWeight: 400, marginLeft: 8, color: COLORS.textMuted }}>
                ({sortedRows.length} rows)
              </span>
            </span>
            <span style={{
              fontSize: 11,
              color: COLORS.textDim,
              fontStyle: 'italic',
              background: COLORS.accent + '18',
              border: `1px solid ${COLORS.accent}33`,
              borderRadius: 3,
              padding: '2px 8px',
            }}>
              $ in thousands
            </span>
          </div>

          {/* Scrollable table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  {dispCols.map(col => {
                    const isSortCol = sort.col === col.code
                    const isLabel = col.code === labelCol
                    return (
                      <th
                        key={col.code}
                        onClick={() => toggleSort(col.code)}
                        title={`Sort by ${col.label}`}
                        style={{
                          padding: '8px 12px',
                          background: COLORS.navyLight,
                          color: isSortCol ? COLORS.accent : COLORS.textDim,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          textAlign: isLabel ? 'left' : 'right',
                          borderBottom: `2px solid ${isSortCol ? COLORS.accent : COLORS.border}`,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          userSelect: 'none',
                          minWidth: isLabel ? 180 : 90,
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        {col.label}
                        {isSortCol && (
                          <span style={{ marginLeft: 4, fontSize: 10 }}>
                            {sort.dir === 'desc' ? '▼' : '▲'}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, ri) => (
                  <DataRow key={ri} row={row} cols={dispCols} labelCol={labelCol} fmtK={fmtK} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DataRow({ row, cols, labelCol, fmtK }) {
  const isTotal = row.type === 'total'
  const isSub   = row.type === 'subtotal'

  const rowBg     = isTotal ? COLORS.gold + '18' : isSub ? COLORS.navyLight + 'cc' : 'transparent'
  const rowColor  = isTotal ? COLORS.gold : COLORS.text
  const fontWeight = isTotal ? 700 : isSub ? 600 : 400

  return (
    <tr style={{ background: rowBg }}>
      {cols.map(col => {
        const val = row.cells[col.code]
        const isDollar = typeof val === 'number'
        const isLabel = col.code === labelCol
        const labelIndent = isTotal ? 10 : isSub ? 18 : 28

        return (
          <td
            key={col.code}
            style={{
              padding: '6px 12px',
              paddingLeft: isLabel ? labelIndent : 12,
              borderBottom: `1px solid ${COLORS.border}22`,
              textAlign: isDollar ? 'right' : 'left',
              color: rowColor,
              fontWeight,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: isDollar ? 'nowrap' : 'normal',
            }}
          >
            {isDollar ? fmtK(val) : (val || '—')}
          </td>
        )
      })}
    </tr>
  )
}

function MetaPill({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 10,
        color: COLORS.textDim,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}
