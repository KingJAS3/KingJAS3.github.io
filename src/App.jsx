import React, { useState, useEffect, useCallback } from 'react'
import { COLORS } from './colors'
import Dropdowns from './components/Dropdowns'
import Breadcrumb from './components/Breadcrumb'
import BudgetViewer from './components/BudgetViewer'

const HEADER_H = 56

export default function App() {
  const [index, setIndex] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [selected, setSelected] = useState({ service: '', appropriation: '', docId: '' })
  const [docData, setDocData] = useState(null)
  const [docLoading, setDocLoading] = useState(false)
  const [breadcrumb, setBreadcrumb] = useState([])

  // Load index.json on mount
  useEffect(() => {
    fetch('/data/index.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => setIndex(data.documents))
      .catch(err => setLoadError(err.message))
  }, [])

  // Load document when selected
  useEffect(() => {
    if (!selected.docId || !index) {
      setDocData(null)
      setBreadcrumb([])
      return
    }
    const entry = index.find(d => d.id === selected.docId)
    if (!entry) return

    setDocLoading(true)
    setDocData(null)

    fetch(`/data/${entry.file}`)
      .then(r => r.json())
      .then(data => {
        setDocData(data)
        setBreadcrumb([entry.service, entry.appropriation, entry.label])
        setDocLoading(false)
      })
      .catch(() => setDocLoading(false))
  }, [selected.docId, index])

  function handleSelectionChange(newSelected) {
    setSelected(newSelected)
    if (newSelected.docId !== selected.docId) {
      setDocData(null)
      setBreadcrumb([])
    }
  }

  // BudgetViewer stores its nav function here via ref-like pattern
  const [viewerNav, setViewerNav] = useState(null)

  const handleBreadcrumbNav = useCallback((i) => {
    if (viewerNav) viewerNav(i)
  }, [viewerNav])

  const handleBreadcrumbUpdate = useCallback((path, navFn) => {
    setBreadcrumb(path)
    if (navFn) setViewerNav(() => navFn)
  }, [])

  return (
    <div style={{
      background: COLORS.bg,
      minHeight: '100vh',
      color: COLORS.text,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <header style={{
        height: HEADER_H,
        background: COLORS.surface,
        borderBottom: `2px solid ${COLORS.accent}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            DoD Budget Explorer
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, letterSpacing: '0.08em' }}>
            FY2026 Budget Justification
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: COLORS.border, margin: '0 8px' }} />
        <div style={{ marginLeft: 'auto', color: COLORS.textMuted, fontSize: 12 }}>
          {index ? `${index.length} document${index.length !== 1 ? 's' : ''}` : loadError ? 'Load error' : 'Loading...'}
        </div>
      </header>

      {/* Dropdowns */}
      <Dropdowns
        documents={index}
        selected={selected}
        onChange={handleSelectionChange}
      />

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <Breadcrumb path={breadcrumb} onNavigate={handleBreadcrumbNav} />
      )}

      {/* Main content */}
      <main style={{ padding: '0 0 40px' }}>
        {loadError && (
          <Notice color="#f44336">
            Could not load document index: {loadError}.
            Run <code>npm run process</code> to generate public/data/.
          </Notice>
        )}

        {!loadError && !selected.docId && index && (
          <Notice color={COLORS.accent}>
            Select a Service, Appropriation, and Document above to begin exploring.
          </Notice>
        )}

        {docLoading && (
          <Notice color={COLORS.textMuted}>Loading document data...</Notice>
        )}

        {docData && !docLoading && (
          <BudgetViewer
            data={docData}
            onBreadcrumbChange={handleBreadcrumbUpdate}
          />
        )}
      </main>
    </div>
  )
}

function Notice({ color, children }) {
  return (
    <div style={{
      margin: '32px auto',
      maxWidth: 640,
      padding: '20px 28px',
      background: color + '18',
      border: `1px solid ${color}44`,
      borderRadius: 8,
      color: COLORS.text,
      fontSize: 14,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}
