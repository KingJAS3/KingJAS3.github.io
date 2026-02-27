import React, { useMemo } from 'react'
import { COLORS } from '../colors'

/**
 * Cascading dropdowns: Service → Appropriation → Document.
 * Reads from index.json documents array.
 */
export default function Dropdowns({ documents, selected, onChange }) {
  const services = useMemo(() => {
    if (!documents) return []
    return [...new Set(documents.map(d => d.service))].sort()
  }, [documents])

  const appropriations = useMemo(() => {
    if (!documents || !selected.service) return []
    return [...new Set(
      documents.filter(d => d.service === selected.service).map(d => d.appropriation)
    )].sort()
  }, [documents, selected.service])

  const docs = useMemo(() => {
    if (!documents || !selected.service || !selected.appropriation) return []
    return documents.filter(
      d => d.service === selected.service && d.appropriation === selected.appropriation
    )
  }, [documents, selected.service, selected.appropriation])

  const selectStyle = {
    background: COLORS.surface,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 5,
    padding: '8px 12px',
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
    outline: 'none',
  }

  const disabledStyle = { ...selectStyle, color: COLORS.textMuted, opacity: 0.6, cursor: 'not-allowed' }
  const labelStyle = { fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase' }
  const groupStyle = { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 180, flex: '1 1 180px', maxWidth: 340 }

  return (
    <div style={{
      display: 'flex', gap: 16, flexWrap: 'wrap', padding: '14px 24px',
      background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, alignItems: 'flex-end',
    }}>
      <div style={groupStyle}>
        <label style={labelStyle}>Service</label>
        <select
          style={documents ? selectStyle : disabledStyle}
          value={selected.service}
          onChange={e => onChange({ service: e.target.value, appropriation: '', docId: '' })}
          disabled={!documents}
        >
          <option value="">— Select Service —</option>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>Appropriation</label>
        <select
          style={selected.service ? selectStyle : disabledStyle}
          value={selected.appropriation}
          onChange={e => onChange({ ...selected, appropriation: e.target.value, docId: '' })}
          disabled={!selected.service}
        >
          <option value="">— Select Appropriation —</option>
          {appropriations.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={groupStyle}>
        <label style={labelStyle}>Document</label>
        <select
          style={selected.appropriation ? selectStyle : disabledStyle}
          value={selected.docId}
          onChange={e => onChange({ ...selected, docId: e.target.value })}
          disabled={!selected.appropriation}
        >
          <option value="">— Select Document —</option>
          {docs.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      </div>
    </div>
  )
}
