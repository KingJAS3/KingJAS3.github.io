import React from 'react'
import { COLORS } from '../colors'

/**
 * Clickable breadcrumb navigation.
 * Each segment except the last is clickable — navigates back to that level.
 *
 * @param {{ path: string[], onNavigate: (index: number) => void }} props
 */
export default function Breadcrumb({ path, onNavigate }) {
  if (!path || path.length === 0) return null

  return (
    <nav
      aria-label="Navigation breadcrumb"
      style={{
        padding: '7px 24px',
        background: COLORS.surface,
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
            {i > 0 && (
              <span style={{ color: COLORS.textMuted, margin: '0 5px' }}>›</span>
            )}
            <span
              onClick={isLast ? undefined : () => onNavigate(i)}
              style={{
                color: isLast ? COLORS.text : COLORS.accent,
                fontWeight: isLast ? 600 : 400,
                cursor: isLast ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {segment}
            </span>
          </React.Fragment>
        )
      })}
    </nav>
  )
}
