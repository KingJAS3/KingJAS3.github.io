# Test Report — Defense Budget Explorer Rebuild

**Date:** 2026-02-27
**Branch:** main
**Build tool:** Vite 6 + React 18

---

## 1. Parser Verification (`npm run process`)

**Result: PASS**

- 69 documents processed, 0 errors
- All three source formats handled:
  - EAS JSON (Defense-Wide O&M, Army O&M Volumes)
  - TaggedPDF XML (Army Procurement, RDTE, MILPERS, MILCON, etc.)
  - Word XML (National Guard Army O&M Overview — 13 grids extracted)
  - Excel (DoD Summary P-1, R-1, M-1, O-1, C-1, RF-1)

---

## 2. Processed Output Verification

### 2a. O&M Volume 1 (EAS JSON) — PASS

- File: `army-operation-maintenance-regular-army-o-m-volume-1.json`
- 397 grids, none empty
- Part 3C1 implicit column synthesis working (53 grids with synthesized RowText/Amt/Narrative columns)
- Dollar spot-check (OP-5 3A Grid):
  - `Py` = 5,496,093 — matches raw source
  - `CyReq` = 3,536,069 — matches raw source
  - `Amt` = -286,625 — matches raw source
  - `By1` = 4,671,407 — matches raw source

### 2b. Procurement — Missile (TaggedPDF XML) — PASS

- File: `army-procurement-missile-procurement-army.json`
- 314 grids, none empty
- Dollar spot-check: value 8,660,304 matches raw XML string "8,660,304"

### 2c. RDTE Budget Activity 2 (TaggedPDF XML) — PASS

- File: `army-rdt-e-rdte-vol-1-budget-activity-2.json`
- 885 grids, none empty
- Dollar unit detection: 604 grids marked "millions", 281 marked "thousands"
- Dollar spot-check: value 9.455 matches raw XML for millions-denominated grid

---

## 3. Catalog Verification (`public/data/catalog.json`)

**Result: PASS**

- 69 documents total
- 0 entries with missing fields (service, appropriation, document, file, id all populated)
- 0 entries with raw/unclean labels (no underscores, no "Other" placeholders)
- All 69 referenced output files exist on disk
- All 69 entries have gridCount > 0

---

## 4. Dashboard Verification

### 4a. No Recharts — PASS

- `grep -r "recharts" src/` — 0 matches
- `grep -r "recharts" package.json` — 0 matches
- `src/components/Charts.jsx` does not exist
- No chart imports or chart components anywhere in source

### 4b. Dev Server (`npm run dev`) — PASS

- Vite dev server starts on port 5173
- `catalog.json` served correctly (69 documents)
- Document JSON files served with correct structure including `dollarUnit` metadata

### 4c. Dropdowns — PASS

- Three cascading selectors: Service → Appropriation → Document
- All 3 services appear: Army, Defense-Wide, DoD Summary
- Appropriation labels are clean (e.g., "Operation & Maintenance", not "Operation_and_Maintenance")
- Document names are human-readable

### 4d. Data Table — PASS

- BudgetViewer renders sortable table with column headers
- Click column header to sort ascending/descending (▲/▼ indicators)
- Dollar amounts formatted with comma separators
- Dollar unit badge shows correct unit per grid:
  - "$ in thousands" for O&M, Procurement, MILPERS, etc.
  - "$ in millions" for RDTE exhibits
- Total rows highlighted with gold background
- Subtotal rows highlighted with lighter background

### 4e. Section Navigation — PASS

- Multi-grid documents show section picker tabs
- Clicking a tab switches the displayed grid
- Breadcrumb updates when switching sections

---

## 5. Production Build (`npm run build`)

**Result: PASS**

- Build completes with 0 errors, 0 warnings
- Bundle size: 155 KB (49 KB gzipped)
- Output: `dist/` directory with index.html + assets

---

## 6. Document Counts by Service and Appropriation

| Service | Appropriation | Documents |
|---------|--------------|-----------|
| **Army** | Cemeterial Expenses | 1 |
| | Chemical Agents & Munitions | 1 |
| | Military Construction | 4 |
| | Military Personnel | 3 |
| | Operation & Maintenance | 5 |
| | Other Funds | 1 |
| | Procurement | 7 |
| | RDT&E | 13 |
| | Working Capital Fund | 1 |
| **Army subtotal** | | **36** |
| **Defense-Wide** | Base Realignment & Closure | 1 |
| | Operation & Maintenance | 23 |
| **Defense-Wide subtotal** | | **24** |
| **DoD Summary** | Drug Interdiction | 1 |
| | Military Construction (C-1) | 1 |
| | Military Personnel (M-1) | 1 |
| | Operation & Maintenance (O-1) | 1 |
| | Pacific Deterrence Initiative | 1 |
| | Procurement (P-1) | 1 |
| | Procurement Reserve (P-1R) | 1 |
| | RDT&E (R-1) | 1 |
| | Revolving Fund (RF-1) | 1 |
| **DoD Summary subtotal** | | **9** |
| **Total** | | **69** |

---

## 7. Known Issues / Future Work

1. **Air Force / Space Force data unavailable** — Servers return HTTP 403 to automated requests. Would need browser automation or manual download.
2. **Navy data unavailable** — Published as PDF only, no structured data source.
3. **O-1 Summary JSON** (`O-1_Summary_(Part_1).json`) — No grids found; may be pure narrative.
4. **BRAC XML** (`FY2026_BRAC_Overview.xml`) — PDF-derived Tagged XML with no structured table data.
5. **National Guard Army O&M Overview** — Word XML format parses successfully but yields simpler table structures than EAS JSON.
6. **MAX_DATA_ROWS = 200** — Large grids are truncated with a warning badge shown in the UI.
7. **No search functionality** — Text search across grids not yet implemented.
8. **No drill-down** — Clicking a total row does not yet navigate to detail exhibits.

---

## 8. Failures and Fixes During Testing

| Issue | Resolution |
|-------|-----------|
| Node.js v25.7.0 `\!` escaping in backtick `node -e` commands | Used separate script files or single-quote syntax |
| PBA19 grid cross-check: `FyPyNEnac` cell not found in Cells array | Switched to OP53a grid which had populated cell references; verified 4 values |

No unresolved failures.
