/**
 * Charts.jsx — reusable Recharts wrappers for the budget data.
 *
 * Recharts is a React charting library that builds on top of SVG (Scalable Vector Graphics).
 * We provide two chart types:
 *   BudgetBarChart — vertical bars, good for comparing line items side by side
 *   BudgetTreemap  — nested rectangles whose size represents funding amount
 *
 * ResponsiveContainer makes charts resize automatically with their parent element.
 *
 * Dollar amounts in the processed data are in THOUSANDS of dollars, so:
 *   1,000 = $1 million, 1,000,000 = $1 billion
 */
import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Treemap,
} from 'recharts'
import { COLORS } from '../colors'

/**
 * Format a number (in thousands) as a compact dollar string.
 * 1,500,000 → "$1.5B"
 * 750,000   → "$750.0M"
 * 500       → "$500K"
 * @param {number|null} val - amount in thousands
 * @returns {string}
 */
export function formatDollars(val) {
  if (val == null || isNaN(val)) return '—'
  const abs = Math.abs(val)
  const sign = val < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}B`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}M`
  return `${sign}$${abs.toFixed(0)}K`
}

/**
 * Custom tooltip content shown when the user hovers over a bar.
 * Recharts passes x, y, payload (the data point), and label to this component.
 */
function CustomTooltip({ active, payload, label }) {
  // "active" means the user is hovering over a bar right now
  if (!active || !payload || payload.length === 0) return null

  return (
    <div style={{
      background: COLORS.navyLight,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '10px 14px',
      maxWidth: 280,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: COLORS.gold, fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span style={{ color: p.fill, fontSize: 12 }}>{p.name}</span>
          <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 12 }}>
            {formatDollars(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * A grouped bar chart for comparing budget amounts across rows.
 *
 * @param {{
 *   data: Array<{name: string, ...numbers}>,
 *   xKey: string,      — which field in data to use for the x-axis labels
 *   bars: Array<{key: string, label: string, color: string}>,
 *   height?: number
 * }} props
 */
export function BudgetBarChart({ data, xKey, bars, height = 320 }) {
  if (!data || data.length === 0) {
    return <EmptyChart message="No numeric data to display." />
  }

  // Truncate long x-axis labels so they don't overlap
  const maxLabelLen = 22
  const displayData = data.map(d => ({
    ...d,
    [xKey]: String(d[xKey] || '').length > maxLabelLen
      ? String(d[xKey]).slice(0, maxLabelLen) + '…'
      : String(d[xKey] || ''),
  }))

  // Rotate x-axis labels when there are many bars to prevent overlap
  const angle = data.length > 6 ? -35 : 0
  const bottomMargin = data.length > 6 ? 70 : 20

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={displayData} margin={{ top: 8, right: 20, left: 16, bottom: bottomMargin }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: COLORS.textDim, fontSize: 11 }}
          angle={angle}
          textAnchor={angle !== 0 ? 'end' : 'middle'}
          interval={0}
          axisLine={{ stroke: COLORS.border }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatDollars}
          tick={{ fill: COLORS.textDim, fontSize: 11 }}
          width={72}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: COLORS.navyLight + '88' }} />
        {bars.length > 1 && (
          <Legend
            wrapperStyle={{ color: COLORS.textDim, paddingTop: 8, fontSize: 12 }}
          />
        )}
        {bars.map(b => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color}
            radius={[3, 3, 0, 0]}  // rounded top corners
            maxBarSize={60}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Custom renderer for Treemap cells.
 * Recharts calls this for every rectangle in the treemap.
 * We draw the rectangle and then overlay text if there's room.
 */
function TreemapCell({ x, y, width, height, name, value, depth, index }) {
  const color = COLORS.bars[index % COLORS.bars.length]

  return (
    <g>
      <rect
        x={x + 1} y={y + 1}
        width={width - 2} height={height - 2}
        fill={color}
        fillOpacity={0.85 - depth * 0.15}
        stroke={COLORS.navy}
        strokeWidth={2}
        rx={4}
      />
      {/* Only render text if the cell is big enough to read */}
      {width > 60 && height > 28 && (
        <text x={x + 8} y={y + 18} fill={COLORS.text} fontSize={11} fontWeight={700}>
          {String(name || '').slice(0, Math.floor(width / 7))}
        </text>
      )}
      {width > 80 && height > 44 && (
        <text x={x + 8} y={y + 32} fill={COLORS.textDim} fontSize={10}>
          {formatDollars(value)}
        </text>
      )}
    </g>
  )
}

/**
 * A treemap that shows proportional budget allocation.
 * Larger rectangles = more funding.
 *
 * @param {{
 *   data: Array<{name: string, value: number, children?: Array}>,
 *   height?: number
 * }} props
 */
export function BudgetTreemap({ data, height = 350 }) {
  if (!data || data.length === 0) {
    return <EmptyChart message="No data to display as treemap." />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={data}
        dataKey="value"
        // content lets us provide a custom cell renderer (our TreemapCell above)
        content={<TreemapCell />}
        animationDuration={300}
      />
    </ResponsiveContainer>
  )
}

/** Small placeholder shown when a chart has no data to render. */
function EmptyChart({ message }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 120,
      color: COLORS.textMuted,
      fontSize: 13,
      border: `1px dashed ${COLORS.border}`,
      borderRadius: 8,
    }}>
      {message}
    </div>
  )
}
