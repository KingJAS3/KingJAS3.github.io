/**
 * App.jsx — the root component that owns all the dashboard state.
 *
 * In React, "state" is data that the UI needs to remember and react to.
 * When state changes, React automatically re-renders the affected parts of the UI.
 *
 * This component:
 *   1. Loads the document catalog on startup
 *   2. Tracks which service / appropriation / document the user has selected
 *   3. Fetches the selected document's data
 *   4. Passes everything down to child components as props
 */
import React, { useState, useEffect } from 'react'
import { COLORS } from './colors'
import Dropdowns from './components/Dropdowns'
import Breadcrumb from './components/Breadcrumb'
import BudgetViewer from './components/BudgetViewer'

// ── Layout constants ─────────────────────────────────────────────────────────
const HEADER_H = 56

export default function App() {
  // "catalog" = the full list of available documents (loaded once from the server).
  // null means "not yet loaded"; an empty array would mean "loaded but empty".
  const [catalog, setCatalog] = useState(null)
  const [loadError, setLoadError] = useState(null)

  // "selected" tracks which dropdown values the user has chosen
  const [selected, setSelected] = useState({ service: '', appropriation: '', docId: '' })

  // "docData" = the currently loaded document (grids, metadata, etc.)
  // null means no document is loaded yet
  const [docData, setDocData] = useState(null)
  const [docLoading, setDocLoading] = useState(false)

  // "breadcrumb" = the navigation path shown above the viewer
  // e.g. ["Defense-Wide", "Operation & Maintenance", "CYBERCOM OP-5", "SAG Parts > Part 1"]
  const [breadcrumb, setBreadcrumb] = useState([])

  // ── Load catalog once when the app first renders ────────────────────────
  // useEffect (a "hook" = a special function that lets components tap into React features)
  // runs the provided function after the component renders.
  // The empty [] dependency array means "only run this once on initial load."
  useEffect(() => {
    fetch('/data/catalog.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setCatalog)
      .catch(err => setLoadError(err.message))
  }, [])

  // ── Load document data whenever the selected document changes ───────────
  useEffect(() => {
    if (!selected.docId || !catalog) {
      setDocData(null)
      setBreadcrumb([])
      return
    }
    const entry = catalog.find(d => d.id === selected.docId)
    if (!entry) return

    setDocLoading(true)
    setDocData(null)

    fetch(`/data/${entry.file}`)
      .then(r => r.json())
      .then(data => {
        setDocData(data)
        setBreadcrumb([data.service, data.appropriation, data.document])
        setDocLoading(false)
      })
      .catch(() => setDocLoading(false))
  }, [selected.docId, catalog])

  // ── Handle dropdown changes ─────────────────────────────────────────────
  // When a higher-level dropdown changes (e.g. Service), reset the lower ones.
  function handleSelectionChange(newSelected) {
    setSelected(newSelected)
    if (newSelected.docId !== selected.docId) {
      setDocData(null)
      setBreadcrumb([])
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  const appStyle = {
    background: COLORS.navy,
    minHeight: '100vh',
    color: COLORS.text,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  }

  const headerStyle = {
    height: HEADER_H,
    background: COLORS.navyMid,
    borderBottom: `2px solid ${COLORS.accent}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: 16,
    position: 'sticky',   // stays at the top even when the user scrolls down
    top: 0,
    zIndex: 100,          // sits above all other content
  }

  const titleStyle = {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.text,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  }

  const subtitleStyle = {
    fontSize: 12,
    color: COLORS.textDim,
    letterSpacing: '0.08em',
  }

  const dividerStyle = {
    width: 1,
    height: 28,
    background: COLORS.border,
    margin: '0 8px',
  }

  const pillStyle = {
    background: COLORS.accent + '22',   // hex alpha: 22 = ~13% opacity
    border: `1px solid ${COLORS.accent}44`,
    color: COLORS.accent,
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
  }

  return (
    <div style={appStyle}>
      {/* ── Top header bar ───────────────────────────────────────────── */}
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>DoD Budget Explorer</div>
          <div style={subtitleStyle}>FY2026 Budget Justification</div>
        </div>
        <div style={dividerStyle} />
        <span style={pillStyle}>UNCLASSIFIED</span>
        <div style={{ marginLeft: 'auto', color: COLORS.textDim, fontSize: 12 }}>
          {catalog ? `${catalog.length} documents` : loadError ? '⚠ Load error' : 'Loading…'}
        </div>
      </header>

      {/* ── Cascading dropdowns ──────────────────────────────────────── */}
      <Dropdowns
        catalog={catalog}
        selected={selected}
        onChange={handleSelectionChange}
      />

      {/* ── Navigation breadcrumb ────────────────────────────────────── */}
      {breadcrumb.length > 0 && (
        <Breadcrumb path={breadcrumb} />
      )}

      {/* ── Main content area ────────────────────────────────────────── */}
      <main style={{ padding: '0 0 40px' }}>
        {loadError && (
          <Notice color={COLORS.red}>
            Could not load document catalog: {loadError}.
            Run <code>npm run build</code> to regenerate public/data/.
          </Notice>
        )}

        {!loadError && !selected.docId && catalog && (
          <Notice color={COLORS.accent}>
            Select a Service, Appropriation, and Document above to begin exploring.
          </Notice>
        )}

        {docLoading && (
          <Notice color={COLORS.textDim}>Loading document data…</Notice>
        )}

        {docData && !docLoading && (
          <BudgetViewer
            data={docData}
            breadcrumb={breadcrumb}
            onBreadcrumbUpdate={setBreadcrumb}
          />
        )}
      </main>
    </div>
  )
}

/**
 * A simple centered notice box for status messages.
 * @param {{ color: string, children: React.ReactNode }} props
 */
function Notice({ color, children }) {
  return (
    <div style={{
      margin: '32px auto',
      maxWidth: 640,
      padding: '20px 28px',
      background: color + '18',
      border: `1px solid ${color}44`,
      borderRadius: 8,
      color: color === COLORS.textDim ? COLORS.textDim : COLORS.text,
      fontSize: 14,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}
