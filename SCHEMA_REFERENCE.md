# Schema Reference — Regular Army O&M Volume 1

**File:** `fy2026_budget/Army/Operation and Maintenance/Regular Army Operation and Maintenance Volume 1.json`
**Size:** ~34 MB
**Format:** EAS (Electronic Accounting System) JSON
**Dollar unit:** Thousands (confirmed by column headers: "Dollars in Thousands", "$ in Thousands")

---

## Top-Level Structure

```json
{
  "Metadata": {
    "SourceSystem": "EAS",
    "ServiceAgencyAcronym": "ARMY",
    "ServiceAgencyName": "ARMY Client Node",
    "BudgetYear": "2025",
    "BudgetCycle": "PB",
    "SubmissionDate": "June 2025",
    "AppropriationNumber": "2020A"
  },
  "GeneratedOutput": {
    "Name": "Volume 1",
    "Type": "Book",
    "Description": "Volume 1",
    "Code": "Volume1",
    "Children": [ ... ]   // 9 top-level children
  }
}
```

**Note:** `BudgetYear` says "2025" but this is the FY2026 President's Budget (PB) submission dated June 2025. The "budget year" in the file is the submission year; the request year is FY2026.

---

## All Node Types (8 total)

| Type | Role | Children location |
|------|------|-------------------|
| `Book` | Root document | `node.GeneratedOutput.Children` |
| `Book Section` | Grouping container (e.g., OP-5 BA levels) | `node.GeneratedOutput.Children` |
| `Exhibit` | Budget exhibit (SAG, O-1, OP-32, etc.) | `node.GeneratedOutput.Children` |
| `Tab Strip` | UI container for tabs | `node.Children` |
| `Tab` | UI tab | `node.Children` |
| `Grid` | Leaf data node with Columns[] and Rows[] | `node.Children` (but rarely has children) |
| `Toggle` | Narrative/text content (no structured data) | — |
| `Text Area` | Free-text content (no structured data) | — |

**Detection rule:** If a node has BOTH `Metadata` AND `GeneratedOutput` properties, it is a "document entity wrapper" (Book, Book Section, or Exhibit). Unwrap to `node.GeneratedOutput` before reading `Children`, `Name`, `Type`, `Code`.

---

## Document Hierarchy (9 Top-Level Children)

```
Book: "Volume 1" (Code: Volume1)
├── [0] Exhibit: PBA-19 Exhibit (Code: PBA19)
│   └── Tab Strip: Tabs
│       ├── Tab: Summary        → Grid: PBA19Summ (1 data row)
│       ├── Tab: BA 01          → Grid: PBA19BA01 (1 data row)
│       ├── Tab: BA 02          → Grid: PBA19BA02 (1 data row)
│       ├── Tab: BA 03          → Grid: PBA19BA03 (1 data row)
│       ├── Tab: BA 04          → Grid: PBA19BA04 (1 data row)
│       └── Tab: PBA19ReadGrid  → Grid: PBA19PBA19ReadGrid (0 data rows — empty)
│
├── [1] Exhibit: O-1 Upload (Code: O1Upload) — Toggle only, no grids
│
├── [2] Exhibit: O-1 Exhibit (Code: O1)
│   ├── Grid: O-1 Grid (Code: O1) — 59 data, 5 total, 14 subtotal rows
│   └── (Toggles: footnote, table)
│
├── [3] Exhibit: OP-32 Exhibit (Code: OP32)
│   └── Grid: OP-32 Grid (Code: OP32) — 82 data, 8 total, 7 subtotal rows
│
├── [4] Exhibit: PB-31D Exhibit (Code: PB31D)
│   └── Tab Strip → Tab: 3C (1)
│       └── Grid: PB31D3C1 — 431 data, 6 total, 30 subtotal rows
│
├── [5] Exhibit: PB-31R Exhibit (Code: PB31R)
│   ├── Grid: PB31ROMASummary — 16 data, 5 total, 8 subtotal rows
│   └── Grid: PB31ROutyearSummary — exists but empty (0 non-blank rows)
│
├── [6] Exhibit: OP-8 Exhibit Part I (Code: OP8P1)
│   └── Tab Strip
│       ├── Tab: PY  → Grid: OP8P1_PY  (45 data, 6 subtotal)
│       ├── Tab: CY  → Grid: OP8P1_CY  (45 data, 6 subtotal)
│       └── Tab: BY1 → Grid: OP8P1_BY1 (45 data, 6 subtotal)
│
├── [7] Exhibit: OP-8 Exhibit Part II (Code: OP8Part2) — Toggle only, no grids
│
└── [8] Book Section: OP-5 Exhibit — THE BULK OF THE DATA (380 grids with data)
    ├── Book Section: BA 01 (21 SAG exhibits)
    ├── Book Section: BA 02 (3 SAG exhibits)
    ├── Book Section: BA 03 (13 SAG exhibits)
    └── Book Section: BA 04 (16 SAG exhibits)
```

---

## Grid Statistics

| Metric | Count |
|--------|-------|
| Total grids | 397 |
| Grids with data rows | 339 |
| Empty grids (no data) | 58 |
| Total data rows | 5,411 |
| Total total rows | 1,296 |
| Total subtotal rows | 2,400 |
| Total header rows | 42 |
| Total blank rows | 1,037 |

---

## All Row Types (5 types)

| Type | Count | Description |
|------|-------|-------------|
| `data` | 5,411 | Regular data rows |
| `total` | 1,296 | Grand total rows |
| `subtotal` | 2,400 | Subtotal rows |
| `header` | 42 | Section headers (e.g., "Budget Activity 01: Operating Forces") |
| `blank` | 1,037 | Visual spacers — no cells, should be filtered out |

---

## All Unique Column Codes (73 total)

### Label columns (text identifying the row)
| Code | Usage |
|------|-------|
| `RowText` | Primary row label — used in nearly every grid |
| `BudgActi` | Budget Activity number (e.g., "01") — O-1 grid |
| `LineItem` | Line item code — OP-32 grid |
| `Line` | Line number — OP-32A grids |
| `ProgElem` | Program Element — 3A grid |
| `Sort` | Sort order column |

### Fiscal year dollar columns
| Code | Meaning | Grid types |
|------|---------|------------|
| `Py` | FY2024 Actual (Prior Year) | O-1, OP-32, 3B2, Part 5, OP-32A |
| `Cy` | FY2025 Enacted (Current Year) | O-1, OP-32, 3B2, Part 5, OP-32A |
| `By1` | FY2026 Budget Request | O-1, OP-32, 3B2, Part 5, OP-32A, 3A |
| `FyPy` | FY2024 (alias) | 3A grid |
| `FyCy` | FY2025 (alias) | OP-8 CY tab header |
| `FyBy1` | FY2026 (alias) | OP-8 BY1 tab header |
| `FyPyNEnac` | FY2024 Actuals | PBA-19 grids |
| `FyCyNEsti` | FY2025 Enacted | PBA-19 grids |
| `FyBy1NChan` | FY2026 Estimate | PBA-19 grids |
| `By2` | FY2027 (outyear) | Part 6 grid |
| `By3` | FY2028 (outyear) | Part 6 grid |
| `By4` | FY2029 (outyear) | Part 6 grid |
| `By5` | FY2030 (outyear) | Part 6 grid |

### Change analysis columns
| Code | Meaning |
|------|---------|
| `PricNChan` | Price change FY24→25 |
| `PricNChan_1` | Price change FY25→26 |
| `ProgNChan` | Program change FY24→25 |
| `ProgNChan_1` | Program change FY25→26 |
| `ChanFycy` | Change FY24→25 |
| `ChanFyby1` | Change FY25→26 |
| `ChanCyBy` | Change CY→BY1 |
| `ChanFyCyBy1` | Change FY24→26 |
| `ChanNFyCyBy1` | Change (variant) |
| `PyCyPricGrow` | Price growth PY→CY ($) |
| `PyCyPricGrowPerc` | Price growth PY→CY (%) |
| `PyCyProgGrow` | Program growth PY→CY ($) |
| `PyCyFcRateDiff` | Foreign currency rate diff PY→CY |
| `CyBy1PricGrow` | Price growth CY→BY1 ($) |
| `CyBy1PricGrowPerc` | Price growth CY→BY1 (%) |
| `CyBy1ProgGrow` | Program growth CY→BY1 ($) |
| `CyBy1FcRateDiff` | Foreign currency rate diff CY→BY1 |

### OP-8 personnel/compensation columns
| Code | Meaning |
|------|---------|
| `begin_strength` | Beginning strength |
| `end_strength` | Ending strength |
| `fte` | Full-Time Equivalents |
| `basic_comp` | Basic compensation |
| `overtime_pay` | Overtime pay |
| `holiday_pay` | Holiday pay |
| `other_oc11` | Other OC-11 |
| `total_variables` | Total variables |
| `comp_oc11` | Compensation OC-11 |
| `benefits_oc12_13` | Benefits OC-12/13 |
| `comp_benefits` | Compensation + benefits |
| `basic_comp_rate` | Basic compensation rate |
| `total_comp_rate` | Total compensation rate |
| `comp_benefits_rate` | Comp + benefits rate |
| `bc_variables` | Base comp variables |
| `bc_benefits` | Base comp benefits |

### 3A grid columns (supplemental/non-supplemental)
| Code | Meaning |
|------|---------|
| `numeric` | Unlabeled numeric column |
| `numeric_1` | Unlabeled numeric column |
| `CyReq` | CY Request |
| `CyAppn` | CY Appropriation |
| `Amt` | Amount (also used in 3C1 cells) |
| `Perc` | Percentage |

### Budget activity breakdown columns
| Code | Usage |
|------|-------|
| `01` | BA 01 amount — PB-31D 3C(1) grid |
| `02` | BA 02 amount — PB-31D 3C(1) grid |
| `03` | BA 03 amount — PB-31D 3C(1) grid |
| `04` | BA 04 amount — PB-31D 3C(1) grid |
| `Tota` | Total — PB-31D 3C(1) grid |

### Base/FTE columns
| Code | Usage |
|------|-------|
| `PyBase` | PY base amount |
| `CyBase` | CY base amount |
| `By1Base` | BY1 base amount |
| `PyFte` | PY FTE count |
| `CyFte` | CY FTE count |
| `By1Fte` | BY1 FTE count |
| `Sqkm` | Square kilometers |

### Display/spacer columns (SKIP THESE)
| Code | Purpose |
|------|---------|
| `TotaObliAuthDollInTh` | Header: "(Dollars in Thousands)" — display only |
| `PyHeader` | Header decoration |
| `ThouHeader` | Header: "($ in Thousands)" — display only |
| `RateHeader` | Header decoration |
| `text` | Generic text column |

### 3C1 implicit columns (not in Columns[], only in cell ColumnCode)
| Code | Type | Meaning |
|------|------|---------|
| `RowText` | text | Row label |
| `Amt` | dollar | Dollar amount |
| `Narrative` | narrative | Justification text with NarrativeData |

---

## Grid Code Frequency (by reuse across SAGs)

| Grid Code | Instances | Total Data Rows | Description |
|-----------|-----------|-----------------|-------------|
| `OP53a` | 53 | 0 | 3A Combined Grid — always empty in this file |
| `Op5Part3b` | 53 | 689 | 3B Change Summary |
| `Op5Part3b2` | 53 | 318 | 3B2 Fiscal Year Comparison |
| `OP5Part3C1` | 53 | 925 | 3C(1) Congressional Adjustments — 0 Columns[], implicit cols |
| `OP5PART5` | 53 | 530 | Part 5 Fiscal Year Summary |
| `Op5PartOp32A` | 53 | 1,966 | OP-32A Detail (largest data source) |
| `OP5Part6` | 53 | 212 | Part 6 Outyear Projections |
| `Op5Part4PerfCrit` | 2+1 | 5+2 | Part 4 Performance Criteria (only in some SAGs) |
| `PBA19Summ` | 1 | 1 | PBA-19 Summary |
| `PBA19BA01–04` | 4 | 4 | PBA-19 by Budget Activity |
| `O1` | 1 | 59 | O-1 Obligation Authority |
| `OP32` | 1 | 82 | OP-32 Summary |
| `PB31D3C1` | 1 | 431 | PB-31D Congressional Action |
| `PB31ROMASummary` | 1 | 16 | PB-31R O&M Summary |
| `OP8P1_PY/CY/BY1` | 3 | 135 | OP-8 Civilian Personnel |
| Various Part 4 | 6 | ~36 | Performance criteria (SAG-specific) |

---

## OP-5 SAG Hierarchy (53 SAG exhibits across 4 Budget Activities)

### BA 01 — Operating Forces (21 SAGs)
| SAG | Code | Name |
|-----|------|------|
| 111 | SAG111 | Maneuver Units |
| 112 | SAG112 | Modular Support Brigades |
| 113 | SAG113 | Echelons Above Brigade |
| 114 | SAG114 | Theater Level Assets |
| 115 | SAG115 | Land Forces Operations Support |
| 116 | SAG116 | Aviation Assets |
| 121 | SAG121 | Force Readiness Operations Support |
| 122 | SAG122 | Land Forces Systems Readiness |
| 123 | SAG123 | Land Forces Depot Maintenance |
| 124 | SAG124 | Medical Readiness |
| 131 | SAG131 | Base Operations Support |
| 132 | SAG132 | Sustainment, Restoration and Modernization |
| 133 | SAG133 | Management and Operational Headquarters |
| 135 | SAG135 | Additional Activities |
| 137 | SAG137 | Reset |
| 141 | SAG141 | U.S. Africa Command |
| 142 | SAG142 | U.S. European Command |
| 143 | SAG143 | U.S. Southern Command |
| 144 | SAG144 | U.S. Forces Korea |
| 151 | SAG151 | Cyber Activities - Cyberspace Operations |
| 153 | SAG153 | Cyber Activities - Cybersecurity |

### BA 02 — Mobilization (3 SAGs)
| SAG | Code | Name |
|-----|------|------|
| 211 | SAG211 | Strategic Mobility |
| 212 | SAG212 | Army Prepositioned Stocks |
| 213 | SAG213 | Industrial Preparedness |

### BA 03 — Training and Recruiting (13 SAGs)
| SAG | Code | Name |
|-----|------|------|
| 311 | SAG311 | Officer Acquisition |
| 312 | SAG312 | Recruit Training |
| 313 | SAG313 | One Station Unit Training |
| 314 | SAG314 | Senior Reserve Officer Training Corps |
| 321 | SAG321 | Specialized Skill Training |
| 322 | SAG322 | Flight Training |
| 323 | SAG323 | Professional Development Education |
| 324 | SAG324 | Training Support |
| 331 | SAG331 | Recruiting and Advertising |
| 332 | SAG332 | Examining |
| 333 | SAG333 | Off-Duty and Voluntary Education |
| 334 | SAG334 | Civilian Education and Training |
| 335 | SAG335 | Junior Reserve Officer Training Corps |

### BA 04 — Administration and Servicewide Activities (16 SAGs)
| SAG | Code | Name |
|-----|------|------|
| 411 | SAG411 | Security Programs |
| 421 | SAG421 | Servicewide Transportation |
| 422 | SAG422 | Central Supply Activities |
| 423 | SAG423 | Logistic Support Activities |
| 424 | SAG424 | Ammunition Management |
| 431 | SAG431 | Administration |
| 432 | SAG432 | Servicewide Communications |
| 433 | SAG433 | Manpower Management |
| 434 | SAG434 | Other Personnel Support |
| 435 | SAG435 | Other Service Support |
| 436 | SAG436 | Army Claims |
| 437 | SAG437 | Other Construction Support and Real Estate Management |
| 438 | SAG438 | Financial Improvement and Audit Readiness (FIAR) |
| 43Q | SAG43Q | Defense Acquisition Workforce Development Fund |
| 441 | SAG441 | International Military Headquarters |
| 442 | SAG442 | Miscellaneous Support of Other Nations |

---

## OP-5 Per-SAG Grid Structure

Each SAG exhibit follows this template (not all grids have data in every SAG):

```
Exhibit: SAG### (e.g., SAG111)
└── Tab Strip: SAG Parts
    ├── Tab: Part 1  → (Toggle only — narrative text)
    ├── Tab: Part 2  → (Toggle only — narrative text)
    ├── Tab: Part 3
    │   └── Tab Strip: Part 3 Tab Strip
    │       ├── Tab: 3A → Tab Strip → Tab: 3A Combined View
    │       │   └── Grid: OP53a (ALWAYS EMPTY — 0 data rows in all 53 SAGs)
    │       ├── Tab: 3B
    │       │   ├── Grid: Op5Part3b (Change summary: RowText, ChanFycy, ChanFyby1)
    │       │   └── Grid: Op5Part3b2 (FY comparison: RowText, Py, Cy, By1)
    │       ├── Tab: 3C (1) → Grid: OP5Part3C1 (Congressional adjustments)
    │       │   [0 defined Columns — cells reference implicit RowText, Amt, Narrative]
    │       ├── Tab: 3C (2) through 3C (9) — (Toggles — narrative text)
    │       └── (no more grids in 3C tabs)
    ├── Tab: Part 4  → (Toggle, or occasionally a Part 4 grid in select SAGs)
    ├── Tab: Part 5  → Grid: OP5PART5 (FY summary: RowText, Py, Cy, By1, ChanCyBy)
    ├── Tab: Part OP-32A → Tab Strip → Tab: OP-32A Combined View
    │   └── Grid: Op5PartOp32A (Detailed line items: 13 columns with growth/price/program)
    └── Tab: Part 6  → Grid: OP5Part6 (Outyear: RowText, By2, By3, By4, By5)
```

---

## Grid Column Schemas by Grid Type

### PBA-19 Summary (PBA19Summ, PBA19BA01–04)
```
RowText | FyPyNEnac | PricNChan | ProgNChan | FyCyNEsti | PricNChan_1 | ProgNChan_1 | FyBy1NChan
```

### O-1 (O1)
```
BudgActi | TotaObliAuthDollInTh | RowText | Py | Cy | By1
```
- `BudgActi`: Budget Activity code (e.g., "01")
- `TotaObliAuthDollInTh`: Display header "(Dollars in Thousands)" — skip in data extraction
- Values: "5,496,093" format (comma-separated, in thousands)

### OP-32 (OP32)
```
LineItem | RowText | Py | PyCyFcRateDiff | PyCyPricGrowPerc | PyCyPricGrow | PyCyProgGrow | Cy | CyBy1FcRateDiff | CyBy1PricGrowPerc | CyBy1PricGrow | CyBy1ProgGrow | By1
```

### PB-31D 3C(1) (PB31D3C1)
```
RowText | 01 | 02 | 03 | 04 | Tota
```
- Columns 01–04 = Budget Activity breakdowns
- `Tota` = total across all BAs

### PB-31R Summary (PB31ROMASummary)
```
RowText | Py | Cy | By1 | ChanFyCyBy1
```

### OP-8 Part I (OP8P1_PY, OP8P1_CY, OP8P1_BY1)
```
[PyHeader|FyCy|FyBy1] | ThouHeader | RateHeader | RowText | begin_strength | end_strength | fte | basic_comp | overtime_pay | holiday_pay | other_oc11 | total_variables | comp_oc11 | benefits_oc12_13 | comp_benefits | basic_comp_rate | total_comp_rate | comp_benefits_rate | bc_variables | bc_benefits
```
- First 3 columns are display headers — skip in data extraction

### OP-5 Part 3B (Op5Part3b)
```
RowText | ChanFycy | ChanFyby1
```

### OP-5 Part 3B2 (Op5Part3b2)
```
RowText | Py | Cy | By1
```

### OP-5 Part 3C(1) (OP5Part3C1) — SPECIAL: 0 defined Columns
Cells reference implicit column codes:
```
RowText (text) | Amt (dollar) | Narrative (narrative — has NarrativeData)
```

### OP-5 Part 5 (OP5PART5)
```
RowText | Py | Cy | By1 | ChanCyBy
```

### OP-5 OP-32A (Op5PartOp32A) — LARGEST DATA SOURCE
```
Line | RowText | Py | PyCyFcRateDiff | PyCyPricGrowPerc | PyCyPricGrow | PyCyProgGrow | Cy | CyBy1FcRateDiff | CyBy1PricGrowPerc | CyBy1PricGrow | CyBy1ProgGrow | By1
```

### OP-5 Part 6 (OP5Part6)
```
RowText | By2 | By3 | By4 | By5
```

---

## Dollar Value Formatting

- All dollar amounts are **strings with commas**: `"5,496,093"`, `"-75,000"`, `"63,953.0"`
- Some values have decimals: `"1,414.2"`, `"-7,809.9"`
- Negative values use leading minus: `"-286,625"`
- Parse: `parseFloat(String(val).replace(/,/g, ''))`
- **All values are in thousands** (confirmed by headers "(Dollars in Thousands)" and "($ in Thousands)")

---

## Cell Types

| Type | Description |
|------|-------------|
| `text` | Label/description text |
| `numeric` | Dollar amount (string with commas) |
| `dollar` | Dollar amount (used in 3C1 cells) |
| `narrative` | Justification text — has NarrativeData object |

---

## NarrativeData Object (in 3C1 Narrative cells)

705 cells across all SAGs have NarrativeData. Structure:
```json
{
  "BaseDollars": 2368390,
  "CCNCode": null,
  "ChgFTE": null,
  "CME": null,
  "FTE": null,
  "FTEBase": null,
  "MIL": null,
  "UserText": "Funds the displaced equipment...",
  "LibraryData": {
    "LibraryTitle": "OOC - Stratlift",
    "NarrativeText": "..."
  }
}
```

---

## Toggle/Text Area Nodes (520 total — all skipped)

These contain narrative text (footnotes, program change explanations, upload placeholders) with no structured grid data. Examples:
- Footnote, Mandatory Funding A, Operations Financed, Overall Assessment
- Upload File, Program Changes 01–04, Footnote 01–04
- Part 1 narrative, Part 2 narrative, Part 3C(2) through 3C(9) narratives

---

## Columns to Skip in Data Extraction

| Code | Reason |
|------|--------|
| `TotaObliAuthDollInTh` | Display header only |
| `PyHeader` | Display header only |
| `ThouHeader` | Display header only |
| `RateHeader` | Display header only |
| `text` | Generic text label column |
| `numeric` | Unlabeled (in 3A grids which are always empty) |
| `numeric_1` | Unlabeled (in 3A grids which are always empty) |

---

## Summary of Data-Bearing Grids

| Grid | Instances | Data Rows | Key Columns | Purpose |
|------|-----------|-----------|-------------|---------|
| Op5PartOp32A | 53 | 1,966 | Line, RowText, Py, Cy, By1 + growth cols | Line-item detail |
| OP5Part3C1 | 53 | 925 | RowText, Amt, Narrative | Congressional adjustments |
| Op5Part3b | 53 | 689 | RowText, ChanFycy, ChanFyby1 | Change summary |
| OP5PART5 | 53 | 530 | RowText, Py, Cy, By1, ChanCyBy | Fiscal year summary |
| PB31D3C1 | 1 | 431 | RowText, 01-04, Tota | Congressional action by BA |
| Op5Part3b2 | 53 | 318 | RowText, Py, Cy, By1 | FY comparison |
| OP5Part6 | 53 | 212 | RowText, By2-By5 | Outyear projections |
| OP8P1_* | 3 | 135 | RowText + 16 personnel cols | Civilian personnel |
| OP32 | 1 | 82 | LineItem, RowText, Py, Cy, By1 + growth | Summary by line item |
| O1 | 1 | 59 | BudgActi, RowText, Py, Cy, By1 | Obligation authority |
| Part 4 variants | ~9 | ~36 | Varies | Performance criteria |
| PB31ROMASummary | 1 | 16 | RowText, Py, Cy, By1, ChanFyCyBy1 | O&M reconciliation |
| PBA19* | 5 | 5 | RowText + change cols | Appropriation highlights |
