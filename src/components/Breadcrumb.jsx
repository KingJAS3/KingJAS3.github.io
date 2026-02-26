/**
 * Breadcrumb.jsx — a trail of ›-separated labels showing where the user is.
 *
 * Example: Defense-Wide › Operation & Maintenance › CYBERCOM OP-5 › SAG Parts › Part 1
 *
 * The last segment is always highlighted as the "current" location;
 * earlier segments are dimmed.
 *
 * @param {{ path: string[] }} props
 */
import React from 'react'
import { COLORS } from '../colors'

export default function Breadcrumb({ path }) {
  if (!path || path.length === 0) return null

  return (
    <nav
      aria-label="Navigation breadcrumb"
      style={{
        padding: '7px 24px',
        background: COLORS.navyMid,
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: 12,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '2px 0',
        minHeight: 32,
      }}
    >
      {path.map((segment, i) => {
        const isLast = i === path.length - 1
        return (
          <React.Fragment key={i}>
            {/* Separator between segments */}
            {i > 0 && (
              <span style={{ color: COLORS.textMuted, margin: '0 5px', fontWeight: 400 }}>
                ›
              </span>
            )}
            {/* The segment itself — current (last) is bright, ancestors are dim */}
            <span style={{
              color: isLast ? COLORS.text : COLORS.textDim,
              fontWeight: isLast ? 600 : 400,
              whiteSpace: 'nowrap',
            }}>
              {segment}
            </span>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
