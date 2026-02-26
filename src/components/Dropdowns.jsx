/**
 * Dropdowns.jsx — three cascading menus: Service → Appropriation → Document.
 *
 * "Cascading" means each menu's options are filtered by what the previous one selected.
 * For example, once you pick "Defense-Wide", only Defense-Wide appropriations appear.
 *
 * useMemo (a React hook) recalculates a value only when its inputs change.
 * We use it here so we don't re-sort and re-filter the catalog on every render.
 *
 * @param {{
 *   catalog: Array|null,
 *   selected: {service: string, appropriation: string, docId: string},
 *   onChange: Function
 * }} props
 */
import React, { useMemo } from 'react'
import { COLORS } from '../colors'

export default function Dropdowns({ catalog, selected, onChange }) {
  // Build the unique sorted service list from the catalog
  const services = useMemo(() => {
    if (!catalog) return []
    return [...new Set(catalog.map(d => d.service))].sort()
  }, [catalog])

  // Filter appropriations to only those matching the selected service
  const appropriations = useMemo(() => {
    if (!catalog || !selected.service) return []
    return [...new Set(
      catalog
        .filter(d => d.service === selected.service)
        .map(d => d.appropriation)
    )].sort()
  }, [catalog, selected.service])

  // Filter documents by both service and appropriation
  const documents = useMemo(() => {
    if (!catalog || !selected.service || !selected.appropriation) return []
    return catalog.filter(
      d => d.service === selected.service && d.appropriation === selected.appropriation
    )
  }, [catalog, selected.service, selected.appropriation])

  // ── Event handlers ───────────────────────────────────────────────────────
  // When Service changes, reset Appropriation and Document to empty.
  function onServiceChange(e) {
    onChange({ service: e.target.value, appropriation: '', docId: '' })
  }
  function onAppropChange(e) {
    onChange({ ...selected, appropriation: e.target.value, docId: '' })
  }
  function onDocChange(e) {
    onChange({ ...selected, docId: e.target.value })
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const containerStyle = {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',    // wraps to next line on narrow screens
    padding: '14px 24px',
    background: COLORS.navyMid,
    borderBottom: `1px solid ${COLORS.border}`,
    alignItems: 'flex-end',
  }

  const groupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    minWidth: 180,
    flex: '1 1 180px',  // grow to fill space, shrink if needed, base width 180px
    maxWidth: 340,
  }

  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.textDim,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  }

  const selectStyle = {
    background: COLORS.navyLight,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 5,
    padding: '8px 12px',
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
    // Outline on focus so keyboard navigation is visible
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  const disabledSelectStyle = {
    ...selectStyle,
    color: COLORS.textMuted,
    cursor: 'not-allowed',
    opacity: 0.6,
  }

  function sel(disabled) {
    return disabled ? disabledSelectStyle : selectStyle
  }

  return (
    <div style={containerStyle}>
      {/* ── Service dropdown ────────────────────────────────────────── */}
      <div style={groupStyle}>
        <label style={labelStyle}>Service</label>
        <select
          style={sel(!catalog)}
          value={selected.service}
          onChange={onServiceChange}
          disabled={!catalog}
        >
          <option value="">— Select Service —</option>
          {services.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* ── Appropriation dropdown ──────────────────────────────────── */}
      <div style={groupStyle}>
        <label style={labelStyle}>Appropriation</label>
        <select
          style={sel(!selected.service)}
          value={selected.appropriation}
          onChange={onAppropChange}
          disabled={!selected.service}
        >
          <option value="">— Select Appropriation —</option>
          {appropriations.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* ── Document dropdown ───────────────────────────────────────── */}
      <div style={groupStyle}>
        <label style={labelStyle}>Document</label>
        <select
          style={sel(!selected.appropriation)}
          value={selected.docId}
          onChange={onDocChange}
          disabled={!selected.appropriation}
        >
          <option value="">— Select Document —</option>
          {documents.map(d => (
            <option key={d.id} value={d.id}>{d.document}</option>
          ))}
        </select>
      </div>

      {/* ── Grid count badge (shown when a document is selected) ────── */}
      {documents.length > 0 && selected.docId && (
        <div style={{
          alignSelf: 'flex-end',
          padding: '8px 14px',
          background: COLORS.navyLight,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 5,
          fontSize: 12,
          color: COLORS.textDim,
          whiteSpace: 'nowrap',
        }}>
          {documents.find(d => d.id === selected.docId)?.gridCount} grids
        </div>
      )}
    </div>
  )
}
