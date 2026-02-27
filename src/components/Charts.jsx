import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Treemap,
} from 'recharts'
import { COLORS } from '../colors'

// ---------------------------------------------------------------------------
// Shared constants & helpers
// ---------------------------------------------------------------------------

const FY_COLORS = {
  Py: '#6366f1',   // indigo — FY2024
  Cy: '#22d3ee',   // cyan   — FY2025
  By1: '#fbbf24',  // amber  — FY2026
}

const TREEMAP_PALETTE = [
  '#6366f1', '#22d3ee', '#fbbf24', '#f472b6',
  '#34d399', '#fb923c', '#a78bfa', '#38bdf8',
]

/** Format thousands value as compact dollar string ($X.XM / $X.XB). */
function fmtCompact(val) {
  if (val == null) return ''
  const abs = Math.abs(val)
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(1)}B`
  if (abs >= 1e3) return `$${(val / 1e3).toFixed(1)}M`
  return `$${val.toFixed(0)}K`
}

/** Custom dark-themed tooltip for bar charts. */
function BarTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      color: COLORS.text,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          <span style={{ color: COLORS.textMuted }}>{p.name}:</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Custom dark-themed tooltip for treemap — reads name/value from payload. */
function TreemapTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const item = payload[0].payload
  return (
    <div style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      color: COLORS.text,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.name}</div>
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCompact(item.value)}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom X-axis tick — horizontal text, truncated to fit
// ---------------------------------------------------------------------------

function BarXTick({ x, y, payload }) {
  const label = payload.value || ''
  const truncated = label.length > 30 ? label.slice(0, 30) + '...' : label
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={12}
        textAnchor="middle"
        fill={COLORS.textMuted}
        fontSize={10}
      >
        {truncated}
      </text>
    </g>
  )
}

// ---------------------------------------------------------------------------
// BudgetBarChart
// ---------------------------------------------------------------------------

export function BudgetBarChart({ data }) {
  if (!data || data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border + '66'} />
        <XAxis
          dataKey="name"
          tick={<BarXTick />}
          interval={0}
          height={50}
        />
        <YAxis
          tick={{ fill: COLORS.textMuted, fontSize: 10 }}
          tickFormatter={fmtCompact}
        />
        <Tooltip content={<BarTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: COLORS.textMuted, paddingTop: 8 }}
        />
        <Bar dataKey="Py" name="FY 2024 Actual" fill={FY_COLORS.Py} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Cy" name="FY 2025 Enacted" fill={FY_COLORS.Cy} radius={[3, 3, 0, 0]} />
        <Bar dataKey="By1" name="FY 2026 Request" fill={FY_COLORS.By1} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// BudgetTreemap
// ---------------------------------------------------------------------------

function TreemapCell({ x, y, width, height, index, name, value }) {
  if (width < 4 || height < 4) return null
  const color = TREEMAP_PALETTE[index % TREEMAP_PALETTE.length]
  const showLabel = width > 50 && height > 30
  const showValue = width > 60 && height > 44

  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        style={{ fill: color, stroke: COLORS.bg, strokeWidth: 2 }}
      />
      {showLabel && (
        <text
          x={x + width / 2} y={y + height / 2 - (showValue ? 6 : 0)}
          textAnchor="middle" dominantBaseline="central"
          style={{ fill: '#fff', fontSize: 10, fontWeight: 600, pointerEvents: 'none' }}
        >
          {name && name.length > 20 ? name.slice(0, 20) + '...' : name}
        </text>
      )}
      {showValue && (
        <text
          x={x + width / 2} y={y + height / 2 + 10}
          textAnchor="middle" dominantBaseline="central"
          style={{ fill: '#ffffffcc', fontSize: 9, pointerEvents: 'none' }}
        >
          {fmtCompact(value)}
        </text>
      )}
    </g>
  )
}

export function BudgetTreemap({ data, valueKey = 'By1' }) {
  if (!data || data.length === 0) return null

  const filtered = data
    .filter(d => d[valueKey] > 0)
    .map(d => ({ name: d.name, value: d[valueKey] }))

  if (filtered.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={250}>
      <Treemap
        data={filtered}
        dataKey="value"
        aspectRatio={4 / 3}
        content={<TreemapCell />}
        isAnimationActive={false}
      >
        <Tooltip content={<TreemapTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  )
}
