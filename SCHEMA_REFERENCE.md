# Army J-Book Schema Reference

Complete structural analysis of all files under `fy2026_budget/Army/`.
Generated 2026-02-27 for parser development.

---

## Table of Contents

1. [File Inventory](#1-file-inventory)
2. [Format Summary](#2-format-summary)
3. [Operation & Maintenance (O&M)](#3-operation--maintenance-om)
4. [Procurement](#4-procurement)
5. [RDT&E](#5-rdte)
6. [Military Personnel (MILPERS)](#6-military-personnel-milpers)
7. [Military Construction (MILCON)](#7-military-construction-milcon)
8. [Other Funds](#8-other-funds)
9. [Cemeterial Expenses](#9-cemeterial-expenses)
10. [AWCF (Army Working Capital Fund)](#10-awcf-army-working-capital-fund)
11. [CAMDD (Chemical Agents & Munitions Destruction)](#11-camdd-chemical-agents--munitions-destruction)
12. [Column Code Cross-Reference](#12-column-code-cross-reference)
13. [Structural Differences: JSON vs XML](#13-structural-differences-json-vs-xml)
14. [Parser Challenges & Edge Cases](#14-parser-challenges--edge-cases)

---

## 1. File Inventory

| # | Directory | File | Format | Size | Tables/Grids |
|---|-----------|------|--------|------|-------------|
| 1 | Operation and Maintenance | Regular Army O&M Volume 1.json | EAS JSON | 33 MB | 397 grids |
| 2 | Operation and Maintenance | Regular Army O&M Volume 2.json | EAS JSON | 25 MB | 18 grids |
| 3 | Operation and Maintenance | National Guard Army O&M Overview.xml | **Word XML** | 839 KB | 13 tables |
| 4 | Operation and Maintenance | Reserve Army O&M.xml | TaggedPDF | 1.2 MB | 127 tables |
| 5 | Operation and Maintenance | Reserve Army O&M Overview.xml | TaggedPDF | 92 KB | 22 tables |
| 6 | Procurement | Missile Procurement Army.xml | TaggedPDF | 0.92 MB | 314 tables |
| 7 | Procurement | Aircraft Procurement Army.xml | TaggedPDF | 0.74 MB | 282 tables |
| 8 | Procurement | Procurement of Weapons & Tracked Combat Vehicles.xml | TaggedPDF | 0.55 MB | 228 tables |
| 9 | Procurement | Procurement of Ammunition.xml | TaggedPDF | 3.68 MB | 1,098 tables |
| 10 | Procurement | Other Procurement - BA1 - Tactical & Support Vehicles.xml | TaggedPDF | 0.77 MB | 244 tables |
| 11 | Procurement | Other Procurement - BA2 - Communications & Electronics.xml | TaggedPDF | 2.08 MB | 712 tables |
| 12 | Procurement | Other Procurement - BA 3, 4 & 6 - Other Support Equipment, Initial Spares and Agile Portfolio Management.xml | TaggedPDF | 2.21 MB | 608 tables |
| 13 | rdte | RDTE - Vol 1 - Budget Activity 1.xml | TaggedPDF | 448 KB | 222 tables |
| 14 | rdte | RDTE - Vol 1 - Budget Activity 2.xml | TaggedPDF | 1.3 MB | 885 tables |
| 15 | rdte | RDTE - Vol 1 - Budget Activity 3.xml | TaggedPDF | 1.1 MB | 728 tables |
| 16 | rdte | RDTE - Vol 2 - Budget Activity 4A.xml | TaggedPDF | 954 KB | 688 tables |
| 17 | rdte | RDTE - Vol 2 - Budget Activity 4B.xml | TaggedPDF | 915 KB | 608 tables |
| 18 | rdte | RDTE - Vol 3 - Budget Activity 5A.xml | TaggedPDF | 909 KB | 654 tables |
| 19 | rdte | RDTE - Vol 3 - Budget Activity 5B.xml | TaggedPDF | 990 KB | 733 tables |
| 20 | rdte | RDTE - Vol 3 - Budget Activity 5C.xml | TaggedPDF | 1.0 MB | 698 tables |
| 21 | rdte | RDTE - Vol 3 - Budget Activity 5D.xml | TaggedPDF | 1.1 MB | 784 tables |
| 22 | rdte | RDTE - Vol 4 - Budget Activity 6.xml | TaggedPDF | 774 KB | 403 tables |
| 23 | rdte | RDTE - Vol 4 - Budget Activity 7.xml | TaggedPDF | 1.0 MB | 744 tables |
| 24 | rdte | RDTE - Vol 4 - Budget Activity 8.xml | TaggedPDF | 70 KB | 35 tables |
| 25 | rdte | RDTE - Vol 4 - Budget Activity 9.xml | TaggedPDF | 324 KB | 252 tables |
| 26 | Military Personnel | Military Personnel Army Volume 1.xml | TaggedPDF | 0.50 MB | 137 tables |
| 27 | Military Personnel | Reserve Personnel Army Volume 1.xml | TaggedPDF | 0.23 MB | 63 tables |
| 28 | Military Personnel | National Guard Personnel Army Volume 1.xml | TaggedPDF | 0.25 MB | 48 tables |
| 29 | Military Construction | Regular Army MILCON, Family Housing & Homeowners.xml | TaggedPDF | 0.64 MB | 166 tables |
| 30 | Military Construction | Reserve Army Military Construction.xml | TaggedPDF | 0.03 MB | 3 tables |
| 31 | Military Construction | Base Realignment and Closure Account.xml | TaggedPDF | 0.55 MB | 131 tables |
| 32 | Military Construction | National Guard Army Military Construction.xml | TaggedPDF | 0.02 MB | 2 tables |
| 33 | Other Funds | Counter-ISIS Train and Equip Fund.xml | TaggedPDF | 0.11 MB | 22 tables |
| 34 | U.S. Army Cemeterial... | Cemeterial Expenses and Construction.xml | TaggedPDF | 0.07 MB | 6 tables |
| 35 | awcf | Army Working Capital Fund.xml | TaggedPDF | 0.24 MB | 55 tables |
| 36 | camdd | Chemical Agents and Munitions Destruction, Defense.xml | TaggedPDF | 0.03 MB | 6 tables |

**Grand totals: 36 files, 12,283 tables/grids**

---

## 2. Format Summary

Three distinct formats are present:

| Format | Files | Description |
|--------|-------|-------------|
| **EAS JSON** | 2 (O&M Vol 1 & 2) | Electronic Accounting System structured JSON. Full hierarchy: Book > Book Section > Exhibit > TabStrip > Tab > Grid. Has typed columns and rows with cell references. |
| **TaggedPDF XML** | 33 | PDF-derived XML via Acrobat SaveAsXML. Root element `<TaggedPDF-doc>`. Tables use `<Table>/<TR>/<TH>/<TD>` elements. |
| **Word XML** | 1 (National Guard O&M Overview) | Microsoft Word flat XML package. Root `<pkg:package>` with `<?mso-application progid="Word.Document"?>`. Tables use `w:tbl/w:tr/w:tc/w:p/w:r/w:t`. |

---

## 3. Operation & Maintenance (O&M)

### 3a. EAS JSON Files (Regular Army O&M)

#### Volume 1 (33 MB, 397 grids)

**Metadata:** ServiceAgencyAcronym: "ARMY", BudgetYear: "2025", AppropriationNumber: "2020A"

**Node type counts:**

| Type | Count | Notes |
|------|-------|-------|
| Book | 1 | Root |
| Book Section | 18 | Budget Activity sections |
| Exhibit | 61 | PBA-19, O-1, OP-32, PB-31D, PB-31R, OP-8, OP-5 |
| Tab Strip | 215 | Layout containers |
| Tab | 1,236 | Content containers |
| Grid | 397 | Data grids with columns/rows |
| Toggle | 413 | Narrative text blocks (no data) |
| Text Area | 107 | Additional text containers |

**Row types across all grids:**

| Type | Count |
|------|-------|
| data | 5,424 |
| subtotal | 2,400 |
| total | 1,299 |
| blank | 1,040 |
| header | 42 |

**Exhibit structure (Book > children):**

| Exhibit | Code | Grids | Purpose |
|---------|------|-------|---------|
| PBA-19 | PBA19 | 6 | Introductory Statement / Appropriation Highlights |
| O-1 Upload | O1Upload | 0 | Upload-only |
| O-1 | O1 | 2 | O&M Total Obligation Authority |
| OP-32 | OP32 | 1 | Appropriation Summary of Price/Program Growth |
| PB-31D | PB31D | 1 | Summary of Funding Increases and Decreases |
| PB-31R | PB31R | 2 | Personnel Summary |
| OP-8 Part I | OP8P1 | 3 | Civilian Personnel Summary (PY/CY/BY1 tabs) |
| OP-8 Part II | OP8Part2 | 0 | Upload-only |
| Book Section: OP-5 | — | 382 | Bulk of data (BA-01 through BA-04) |

**OP-5 Sub-Activity Group (SAG) repeating pattern** (repeated ~55 times):
Each SAG exhibit contains these grid types:
- `OP53a` — 3A Combined Grid (11 cols): Program Elements with dollar amounts
- `Op5Part3b` — Reconciliation Summary (3 cols)
- `Op5Part3b2` — Summary of Operational Category (4 cols)
- `OP5Part3C1` — **0 defined columns** — cells use implicit RowText/Amt/Narrative
- `OP5PART5` — Personnel End Strength (5 cols)
- `Op5PartOp32A` — Price/Program Growth (13 cols)
- `OP5Part6` — Outyear projections (5 cols: FY2027-2030)
- `OP5Part4PerfCrit` / `SAG*Part4*` — Performance Criteria (varies)

**Hierarchy depth varies:** Shallowest = 3 levels (Book > Exhibit > Grid); Deepest = 12 levels (nested TabStrips within OP-5 3A Combined).

**All 82 unique column codes (Volume 1):**

FY Budget Data:
- `Py` / `FyPy` — FY 2024 Actual (Prior Year)
- `Cy` / `FyCy` — FY 2025 Enacted (Current Year)
- `By1` / `FyBy1` — FY 2026 Estimate (Budget Year)
- `By2` — FY 2027
- `By3` — FY 2028
- `By4` — FY 2029
- `By5` — FY 2030
- `FyPyNEnac` — FY 2024 Actuals (PBA-19 specific)
- `FyCyNEsti` — FY 2025 Enacted (PBA-19 specific)
- `FyBy1NChan` — FY 2026 Estimate (PBA-19 specific)
- `FyPyPyh` / `FyCyCyh` / `FyBy1By1h` — Part 4 header variants
- `FyBy1Requ` — FY 2026 Request (3B1 reconciliation)

Change/Growth:
- `PricNChan` / `PricNChan_1` — Price Change (PBA-19)
- `ProgNChan` / `ProgNChan_1` — Program Change (PBA-19)
- `PyCyFcRateDiff` / `CyBy1FcRateDiff` — Foreign Currency Rate Diff (OP-32A)
- `PyCyPricGrowPerc` / `CyBy1PricGrowPerc` — Price Growth Percent (OP-32A)
- `PyCyPricGrow` / `CyBy1PricGrow` — Price Growth $ (OP-32A)
- `PyCyProgGrow` / `CyBy1ProgGrow` — Program Growth $ (OP-32A)
- `ChanCyBy` — Change FY 2025/2026 (Part 5)
- `ChanFyCyBy1` — Change FY 2025/2026 (PB-31R)
- `ChanFycy` / `ChanFyby1` — 3B reconciliation changes
- `ChanNFyCyBy1` — Part 4 change

Reconciliation (3A):
- `ProgElem` — Program element label (text)
- `CyReq` — CY budget request
- `Amt` — Delta amount
- `Perc` — Percentage change
- `CyAppn` — CY appropriation
- `RecoCate` — Reconciliation category

Civilian Personnel (OP-8):
- `begin_strength`, `end_strength`, `fte`
- `basic_comp`, `overtime_pay`, `holiday_pay`, `other_oc11`
- `total_variables`, `comp_oc11`, `benefits_oc12_13`, `comp_benefits`
- `basic_comp_rate`, `total_comp_rate`, `comp_benefits_rate`
- `bc_variables`, `bc_benefits`

Personnel Summary (Part 4):
- `PyBase`, `PyFte`, `CyBase`, `CyFte`, `By1Base`, `By1Fte`

PB-31D (3C(1) by Budget Activity):
- `01`, `02`, `03`, `04`, `Tota` — BA columns + total

Label/Header:
- `RowText` — Primary label column
- `LineItem`, `Line` — Line item/number
- `BudgActi` — Budget activity number
- `TotaObliAuthDollInTh` — "(Dollars in Thousands)"
- `PyHeader`, `ThouHeader`, `RateHeader` — OP-8 section headers
- `Sort`, `Sqkm`, `text`, `numeric`, `numeric_1` — Misnamed/spacer columns

Implicit (not in column definitions, used only in cell ColumnCode refs):
- `Narrative` — Narrative text in Part 3C1 grids (53 grids have 0 column definitions)

**New column type: `dollar`** — Used in 3A Combined Grid and Part 3C1 Grid, distinct from `numeric`. Also `percent` type for price growth percentage columns.

#### Volume 2 (25 MB, 18 grids)

**No Book Sections** — flat structure: Book > 13 Exhibits directly.

| Exhibit | Code | Grids | Purpose |
|---------|------|-------|---------|
| PB-15 | PB15 | 1 | Advisory and Assistance Services |
| PB-24 | PB24 | 12 | Professional Military Education Schools (4 schools x 3 grids) |
| PB-31Q | PB31Q | 5 | Manpower Changes in FTEs |
| 10 others | — | 0 | Upload-only exhibits |

**28 unique column codes (Volume 2):**
- `RowText`, `Py`, `Cy`, `By1`, `FyCy` — Same as Vol 1
- `BudgRequ` — Budget Request amount
- `Current` — Current Enacted amount
- `CyBy1Chan` — FY 2025/2026 Change
- `UsDireHire`, `DireHire`, `IndiHire` — PB-31Q personnel types
- `ForeNati`, `Tota` — Foreign National header, Total
- `BlnkCol`, `BlnkCol_1`, `BlnkCol_3` — Blank spacers
- `lvl1Col_1` through `lvl1Col_5`, `Lvl1Col_3Cy` — Multi-level header spacers
- `numeric_1` through `numeric_4` — Header spacers

### 3b. TaggedPDF Files (Reserve Army O&M)

#### Reserve Army O&M (1.2 MB, 127 tables)

**37 unique column patterns.** Contains 18 repeating SAG sections, each with a consistent 5-table block:
1. Personnel Summary (5 cols): `[blank] | FY 2024 | FY 2025 | FY 2026 | Change FY 2025/2026`
2. OP-32A Line Items (13 cols): `[blank] | [blank] | FY 2024 Program | FC Rate Diff | Price Growth Percent | Price Growth | Program Growth | FY 2025 Program | FC Rate Diff | Price Growth Percent | Price Growth | Program Growth | FY 2026 Program`
3. Financial Summary A (8 cols, multi-row header): `A. Program Elements | FY 2024 Actuals | Budget Request | Amount | Percent | Appn | Normalized Current Enacted | FY 2026 Estimate`
4. Reconciliation Summary (3 cols): `B. Reconciliation Summary | Change FY 2025/FY 2025 | Change FY 2025/FY 2026`
5. Reconciliation Narrative (1 col): Single-column text

Also has:
- Appropriation Summary tables (8 cols): `[Title] | FY 2024 Actuals | Price Change | Program Change | FY 2025 Enacted | Price Change | Program Change | FY 2026 Estimate`
- Training category tables, audit facilitation tables, RMIC tables
- Narrative blocks (1-column, 1-row, all-TH)

#### Reserve Army O&M Overview (92 KB, 22 tables)

15 unique column patterns. Dominant:
- 8-col Appropriation Summary (8 tables)
- 6-col Personnel/Program Data (5 tables)
- 4-col FY comparison (2 tables)
- Multi-row headers with mismatched column counts (Row 1: 4-6 FY super-headers; Row 2: 7-9 sub-columns)

### 3c. Word XML File (National Guard O&M Overview)

**Format: `pkg:package` — Microsoft Word flat XML.** NOT TaggedPDF, NOT EAS.

Tables use `w:tbl > w:tr > w:tc > w:p > w:r > w:t`. Text is fragmented across multiple `w:r` (run) elements with different formatting.

**13 tables found.** Dominant pattern is 8-column:
`[Title] | FY 2024 Actuals | Price Change | Program Change | FY 2025 Enacted | Price Change | Program Change | FY 2026 Estimate`

Also: 6-col Program/Personnel Data, 7-col Installation counts (FY x CONUS/Overseas), 9-col Funded Executable/Unfunded tables.

**The existing `parseXml()` cannot handle this format.** Would need a new Word XML parser.

---

## 4. Procurement

**7 files, all TaggedPDF format, 3,486 tables total.**

| File | Tables | Size |
|------|--------|------|
| Procurement of Ammunition | 1,098 | 3.68 MB |
| Other Procurement BA2 - Comms & Electronics | 712 | 2.08 MB |
| Other Procurement BA 3,4,6 - Other Support | 608 | 2.21 MB |
| Missile Procurement Army | 314 | 0.92 MB |
| Aircraft Procurement Army | 282 | 0.74 MB |
| Other Procurement BA1 - Tactical & Support | 244 | 0.77 MB |
| Procurement of Weapons & Tracked Combat Vehicles | 228 | 0.55 MB |

### Table Types (all files combined)

| Table Type | Count | Description |
|------------|-------|-------------|
| P-5 Cost Analysis | 1,891 | Cost element breakdowns per line item |
| Secondary Distribution | 493 | Funds distribution by component (Army, ANG, AR) |
| P-21 Production Schedule | 454 | Production delivery schedules |
| P-3a Procurement History | 238 | Individual modification history |
| Other/Unknown | 340 | P-1 detail, appropriation breakdowns, misc |
| Line Item TOC | 48 | Table of contents |
| P-1 Procurement Program | 9 | P-10 advance procurement |
| Resource Summary | 6 | Resource summary rollups |
| Cost Element | 4 | Installation cost breakdowns |
| P-40 Budget Line Item | 2 | Aggregated item justifications |
| Appropriation Summary | 1 | Top-level summary |

### Key Table Patterns

**1. Appropriation Summary (P-1 top level, 5-6 cols):**
```
Header: Appropriation Summary | FY 2024 Actuals | FY 2025 Enacted | FY 2026 Request1 | FY 2026 Reconciliation | FY 2026 Total
```
Values in thousands with commas. First cell is TH (row label), rest TD.

**2. P-5 Cost Analysis (most common, 1,891 tables):**

Header table (2-3 cols):
```
Exhibit P-5, Cost Analysis: PB 2026 Army | Date: June 2025
```

Data table (12-14 cols with sub-columns per FY period):
```
Cost Elements | Prior Years | FY 2024 | FY 2025 | FY 2026 Base | FY 2026 OOC | FY 2026 Total
Sub-row: Unit Cost ($ K) | Qty (Each) | Total Cost ($ M) [repeated per FY]
```

**CRITICAL: Mixed dollar units in P-5.** Unit Cost in `$ in Thousands`, Total Cost in `$ in Millions`.

**3. Secondary Distribution (493 tables):**

10-column variant (with outyears):
```
Secondary Distribution | FY 2024 | FY 2025 | FY 2026 Base | FY 2026 OOC | FY 2026 Total | FY 2027 | FY 2028 | FY 2029 | FY 2030
```

6-column variant (current years only):
```
Secondary Distribution | FY 2024 | FY 2025 | FY 2026 Base | FY 2026 OOC | FY 2026 Total
```

**4. Resource Summary (6 tables, 13 cols):**
```
Resource Summary | Prior Years | FY 2024 | FY 2025 | FY 2026 Base | FY 2026 OOC | FY 2026 Total | FY 2027-2030 | To Complete | Total
```
Row labels: Procurement Quantity (Units in Each), Gross/Weapon System Cost ($ in Millions), Net Procurement (P-1) ($ in Millions), Total Obligation Authority ($ in Millions), Flyaway Unit Cost ($ in Thousands), etc.

**5. P-21 Production Schedule (454 tables):** Variable column counts, delivery quantities by FY.

**6. P-3a Individual Modification (238 tables):** 11 cols, often all-TD with no TH header row.

### Procurement-Specific Column Headers

FY Columns:
- `FY 2024`, `FY 2024 Actuals`, `FY 2024 Actuals Quantity Cost`
- `FY 2025`, `FY 2025 Enacted`, `FY 2025 Enacted Quantity Cost`
- `FY 2026`, `FY 2026 Base`, `FY 2026 OOC`, `FY 2026 Total`, `FY 2026 Request1`, `FY 2026 Reconciliation`
- `FY 2027`, `FY 2028`, `FY 2029`, `FY 2030`
- `Prior Years`, `To Complete`, `Total`

Cost Sub-Columns:
- `Unit Cost ($ K)`, `Qty (Each)`, `Total Cost ($ M)`
- `Cost Elements`, `Cost Element Breakout`

Financial:
- `Procurement Quantity (Units in Each)`
- `Gross/Weapon System Cost ($ in Millions)`, `Gross/Weapon System Unit Cost ($ in Thousands)`
- `Net Procurement (P-1) ($ in Millions)`, `Total Obligation Authority ($ in Millions)`
- `Flyaway Unit Cost ($ in Thousands)`, `Flyaway Cost`, `Initial Spares ($ in Millions)`

P-1 Detail:
- `Appropriation Summary`, `Line No`, `Line #`, `Ident Code`, `Sec`, `BA`, `BSA`
- `Line Item Number`, `Line Item Title`, `Page`
- `Quantity`, `Cost`, `Actuals`, `Enacted`, `Request1`, `Reconciliation`

### Figure Elements with Embedded Data

**1,062 figures (out of 2,615 total) contain structured budget data as plain text** inside `<Figure>` tags. This includes P-40 Budget Line Item Justification Resource Summary data. A parser that only processes `<Table>` tags will miss this data.

---

## 5. RDT&E

**13 files, all TaggedPDF format, 7,434 tables total.**

| File | Tables | Size |
|------|--------|------|
| BA 1 | 222 | 448 KB |
| BA 2 | 885 | 1.3 MB |
| BA 3 | 728 | 1.1 MB |
| BA 4A | 688 | 954 KB |
| BA 4B | 608 | 915 KB |
| BA 5A | 654 | 909 KB |
| BA 5B | 733 | 990 KB |
| BA 5C | 698 | 1.0 MB |
| BA 5D | 784 | 1.1 MB |
| BA 6 | 403 | 774 KB |
| BA 7 | 744 | 1.0 MB |
| BA 8 | 35 | 70 KB |
| BA 9 | 252 | 324 KB |

### Table Classification (all files)

| Type | Count | Description |
|------|-------|-------------|
| exhibit-header | 2,582 | Exhibit label rows (R-2, R-2A, R-3, R-4, R-4A) |
| accomplishments | 1,825 | Section B narrative + dollar tables |
| fiscal-data | 989 | Product Dev, Test & Eval, Support, Mgmt Services |
| COST-summary | 962 | R-2 COST summary grids |
| fiscal-other | 402 | Prior Years / Cost To Complete / Total Cost |
| other | 345 | Schedule, misc |
| congressional-adds | 100 | Congressional add details |
| other-program-funding | 99 | Section C funding summaries |
| budget-activity | 53 | Appropriation/BA-level summaries |
| acquisition-strategy | 49 | Acquisition strategy tables |
| project-index | 26 | TOC tables |

### Key Table Patterns

**1. COST Summary (962 tables, 13 cols) — R-2 exhibit:**
```
COST ($ in Millions) | Prior Years | FY 2024 | FY 2025 | FY 2026 Base | FY 2026 OOC | FY 2026 Total | FY 2027 | FY 2028 | FY 2029 | FY 2030 | Cost To Complete | Total Cost
```
94% (906 tables) use this exact 13-column format. 35 tables have a 14th empty column.

**ALL RDTE financial data is in `$ in Millions` (NOT thousands).**

**2. Accomplishments (1,825 tables) — R-2A Section B:**

Primary (81%, 1,473 tables):
```
B. Accomplishments/Planned Programs ($ in Millions) | FY 2024 | FY 2025 | FY 2026
```

Extended (10%, 187 tables):
```
B. Accomplishments/Planned Programs ($ in Millions) | FY 2024 | FY 2025 | FY 2026 Base | FY 2026 OOC | FY 2026 Total
```

Continuation (60 tables):
```
... ($ in Millions) | FY 2024 | FY 2025
```

**3. Fiscal Data (989 tables) — R-3 cost analysis:**

Four sub-types with similar FY structure:
- `Product Development ($ in Millions)` — 308 tables
- `Test and Evaluation ($ in Millions)` — 265 tables
- `Management Services ($ in Millions)` — 233 tables
- `Support ($ in Millions)` — 189 tables

Common pattern (9 cols):
```
<type> ($ in Millions) | [empty] | FY 2024 | FY 2025 | FY 2026 Base | FY 2026 OOC | FY 2026 Total | [optional trailing empties]
```

**4. Project Index (26 tables, 2 per file):**
```
Budget Activity | OSDPE / Project | Project Title
```

### Structural Differences by Budget Activity Group

- **Vol 1 (BA 1-3):** R-2 format only. No R-3/R-4 exhibits. Only COST-summary + accomplishments + exhibit-headers + congressional-adds.
- **Vol 2-4 (BA 4-9):** Full R-2, R-3, R-4, R-4A exhibits. Adds fiscal-data, acquisition-strategy, schedule, other-program-funding.
- **BA 8:** Smallest (35 tables) — only 1 program element (Defensive CYBER).

### RDTE-Specific Observations

- **Column-splitting artifacts:** 5-10% of accomplishments tables have headers split mid-word (e.g., `Progra | ms ($ in Millions)`)
- **Self-closing tags ubiquitous:** 31,512 `<TD/>` and 9,396 `<TH/>` (empty cells) — ~40% of all cells
- **`<Figure>` elements (834):** Images embedded in cells, must be stripped when extracting text
- **Mixed TH/TD rows:** Total/subtotal rows use TH for emphasis

---

## 6. Military Personnel (MILPERS)

**3 files, all TaggedPDF format, 248 tables total.**

### Military Personnel Army Volume 1 (0.50 MB, 137 tables, 158 unique headers)

**Exhibit types:** PB-30A (Summary by Budget Program), PB-30B (Personnel Strength), PB-30C (End Strengths by Grade), PB-30J/K/O/P (Entitlements, Changes, Increases/Decreases), PB-30Q (Outside DoD), PB-30R (Reimbursable), PB-30S/T (ROTC), PB-30X (Pay/allowance justifications), PB-30Z (Monthly End Strengths)

FY columns: `FY 2024 ACTUALS`, `FY 2025 ENACTMENT`, `FY 2026 DISC REQUEST /1`
Also: `ACTUAL FY 2024`, `ESTIMATE FY 2025`, `ESTIMATE FY 2026`

Unique features:
- Monthly columns: `OCT, NOV, DEC, JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP`
- Budget Activity columns: `BA1, BA2, BA3, BA4, BA5, BA6`
- Very long section-title headers (full exhibit title in header cell)
- Mix of 4-col (FY comparison) and 10-13 col (detail) tables
- 1,416 self-closing `<TD/>`, 306 `<TH/>`

### Reserve Personnel Army Volume 1 (0.23 MB, 63 tables, 88 unique headers)

**Exhibit types:** PB-30G (Summary), PB-30H (Tours by Grade), PB-30J (Entitlements by Subactivity), PB-30K (Appropriation Changes), PB-30L (Basic Pay/Retired Pay), PB-30O (Increases/Decreases), PB-30R (Reimbursable), PB-30U (BAS/SIK), PB-30W (Full-Time Support), PB-30X (Purpose & Scope), PB-30Y (Performance Measures)

FY columns: `FY 2024 ACTUALS`, `FY 2025 ENACTMENT`, `FY 2026 ESTIMATE`
Also: `Total Obligational Authority (Dollars in Thousands)`

Quirks:
- OCR artifacts: `Arm:z'`, `SuEeort`, `Suppl-ntal`
- Multi-row headers: rows 1-5 can be headers before data starts
- Uneven column counts across rows (common)
- 1,295 self-closing `<TD/>`, 125 `<TH/>`

### National Guard Personnel Army Volume 1 (0.25 MB, 48 tables, 132 unique headers)

**CRITICAL: Severely broken OCR throughout.** Character-spaced text:
- `A C T U A L F Y 2 0 2 4` instead of `ACTUAL FY 2024`
- `N A TI O N A L G U A R D P E R S O N N E L, A R M Y`
- `(I N T H O U S A N D S O F D O L L A R S)`
- Garbled numerics: `55:.,,;32 :., 105, 2C4 4,921,233 59,713 8,-9()7`

FY columns (spaced): `EST ACTL FY 2024`, `ESTIMATE FY 2025`, `REQUEST FY 2026`

Tables have up to 23 columns. **This file may need to be skipped or handled with special OCR cleanup.**

---

## 7. Military Construction (MILCON)

**4 files, all TaggedPDF format, 302 tables total.**

### Regular Army MILCON, Family Housing & Homeowners (0.64 MB, 166 tables, 320 unique headers)

Largest variety. Contains:
- Extension of Project Authorizations
- Unaccompanied Housing (UH-6) exhibits
- Family Housing (FH-2, FH-4, FH-11) exhibits
- GFOQ (General/Flag Officer Quarters) — ~100 individual quarters reports
- Leasing Account, Operation/Maintenance/Utilities
- Homeowners Assistance (HA-1, HA-2)

FY columns: `FY 2024`, `FY 2025`, `FY 2026`, `FY 2024 Budget Actual`, `FY 2025 Budget Enactment`, `FY 2026 Budget Request`, `FY2024 (Estimate)`, `FY2025 (Estimate)`, `FY2026 (Estimate)`

Location columns: `State`, `State/Country`, `Installation or Location`, `Project`, `Quarters ID`, `Quarters Address`

Table variety: 1-18 columns, 0-49 data rows. Dollar amounts embedded as header text (e.g., `$2,375,339.51`). Long narrative project descriptions in headers.

### BRAC Account (0.55 MB, 131 tables, 70 unique headers)

Extremely repetitive — alternating BC-01/BC-02/BC-03 exhibit pairs per BRAC installation (~35 installations):
- BC-01: Financial Summary (22 rows x 8 cols)
- BC-02: Cost and Savings (28-29 rows x 8 cols)
- 2-row x 5-col environmental/caretaker summary

Historical FY columns: `FY 1990` through `FY 2011`, plus BRAC round period totals.
**Dollar amounts in MILLIONS (not thousands).**

### Reserve Army MILCON (0.03 MB, 3 tables)

Minimal: FY 2026 Summary (20 rows x 4 cols), fiscal year table (3 rows x 2 cols), project extension (2 rows x 5 cols). `$ in thousands`.

### National Guard Army MILCON (0.02 MB, 2 tables)

Minimal: Project authorization extensions and authorization summary.

---

## 8. Other Funds

### Counter-ISIS Train and Equip Fund (0.11 MB, 22 tables, 78 unique headers)

**Cleanest file in the entire Army set** — no self-closing TD/TH tags.

FY columns: `FY 2024 Enacted`, `FY 2024 Request`, `FY 2025 Enacted`, `FY 2025 Request`, `FY 2026 Request`

Summary tables: 4 cols (Category + 3 FY amounts)
Detail tables: Training & Equipment by partner force (CTS T&E, MoD T&E, MoPA T&E)
Sustainment tables: Supply class breakdowns (Class I through IX)

3 tables have 0 data rows (headers only).

---

## 9. Cemeterial Expenses

### Cemeterial Expenses and Construction (0.07 MB, 6 tables, 19 unique headers)

FY columns: `FY 2024 Actuals`, `FY 2024 Enacted`, `FY 2024 Program`, `FY 2025 Enacted`, `FY 2025 Program`, `FY 2026 Requested`, `FY 2026 Program`, `Totals`, `Change`

Table types:
- Budget line-item detail (7 rows x 8 cols)
- Appropriation summary (7 rows x 11 cols)
- Price/Program growth (8 rows x 11 cols)
- Object class summary (17 rows x 6 cols)
- Reconciliation of appropriations (15 rows x 6 cols)
- Personnel requirements (8 rows x 9 cols)

Uneven columns (8-11 cols in different rows of same table), but otherwise clean.

---

## 10. AWCF (Army Working Capital Fund)

### Army Working Capital Fund (0.24 MB, 55 tables, 57 unique headers)

FY columns: `FY 2024`, `FY 2025`, `FY 2026`
Also: `Summary of Budget Activity ($ in Thousands)`, `President's Budget FY 2026 Summary ($ in Thousands)`
Financial: `Revenue`, `Total Cost`, `QTY`, `SCL`, `Demand Based`, `Non-Demand Based`, `Mobilization Non-Demand Based`

Table types:
- Summary tables (4 cols): item, FY 2024, FY 2025, FY 2026
- Cash Plan (25 cols): wide multi-period table
- Capital Budget (5-6 cols): project details
- Workload tables (5 cols per depot)
- Capital Budget Execution (6 cols)

**Mixed dollar units:** "$ in Thousands" and "$ in Millions" depending on exhibit.

Quirks:
- Chart axis labels appearing as headers: `$ Millions 8,000 6,000 4,000 2,000 0`
- Photo captions as headers: `Anniston Army Depot small arms technician...`
- 643 self-closing `<TD/>`, 61 `<TH/>`
- One empty table (0 data rows)

---

## 11. CAMDD (Chemical Agents & Munitions Destruction)

### Chemical Agents and Munitions Destruction, Defense (0.03 MB, 6 tables, 7 unique headers)

Uses R-1 exhibit format (non-RDTE title):
- Table 0: R-1 summary (5 rows x 8 cols) — FY 2024 Actual, FY 2025 Enacted, FY 2025 Supplemental, FY 2025 Total, FY 2026 Request, FY 2026 Reconciliation, FY 2026 Total
- Table 1: R-1 detail (5 rows x 11 cols)
- Tables 2-4: Milestone tables (2 cols, date/description)
- Table 5: Funded Financial Summary (13 rows x 4 cols)

**Dollar amounts in Thousands.**

OCR typos: `RDTE Titie`, `ROTE Tit1e`, `Do11ars`, `Chemicai`, `Actual.a`

---

## 12. Column Code Cross-Reference

### Shared FY Column Patterns Across All Appropriation Types

| Concept | EAS JSON Code | TaggedPDF Header Text (varies) |
|---------|--------------|-------------------------------|
| FY 2024 Prior Year | `Py`, `FyPy` | `FY 2024`, `FY 2024 Actuals`, `FY 2024 ACTUALS`, `FY 2024 Actual`, `FY 2024 Program`, `ACTUAL FY 2024`, `FY 2024 Enacted`, `FY 2024 Budget Actual` |
| FY 2025 Current Year | `Cy`, `FyCy` | `FY 2025`, `FY 2025 Enacted`, `FY 2025 ENACTMENT`, `FY 2025 Program`, `FY 2025 Budget Enactment`, `ESTIMATE FY 2025` |
| FY 2026 Budget Year | `By1`, `FyBy1` | `FY 2026`, `FY 2026 Estimate`, `FY 2026 Request`, `FY 2026 Total`, `FY 2026 DISC REQUEST /1`, `FY 2026 Budget Request`, `FY 2026 Requested`, `REQUEST FY 2026`, `ESTIMATE FY 2026` |
| FY 2026 Base | — | `FY 2026 Base` (Procurement, RDTE only) |
| FY 2026 OOC | — | `FY 2026 OOC` (Procurement, RDTE only) |
| FY 2026 Reconciliation | — | `FY 2026 Reconciliation`, `FY 2026 Reconciliation Request` |
| FY 2027-2030 Out-years | `By2`-`By5` | `FY 2027`, `FY 2028`, `FY 2029`, `FY 2030` |
| Prior Years | — | `Prior Years` (Procurement, RDTE) |
| Cost To Complete | — | `Cost To Complete`, `To Complete` (Procurement, RDTE) |
| Total Cost | — | `Total Cost`, `Total` |

### Columns Unique to Specific Appropriation Types

**O&M only (EAS JSON):**
- Price/Program growth: `PyCyPricGrow`, `PyCyProgGrow`, `CyBy1PricGrow`, `CyBy1ProgGrow`, etc.
- Foreign currency: `PyCyFcRateDiff`, `CyBy1FcRateDiff`
- Civilian personnel: `begin_strength`, `end_strength`, `fte`, `basic_comp`, `overtime_pay`, etc.
- Reconciliation: `ProgElem`, `CyReq`, `CyAppn`, `RecoCate`
- Personnel summary: `PyBase`, `PyFte`, `CyBase`, `CyFte`, `By1Base`, `By1Fte`
- PB-31Q: `UsDireHire`, `DireHire`, `IndiHire`, `ForeNati`

**Procurement only (TaggedPDF):**
- P-5 sub-columns: `Unit Cost ($ K)`, `Qty (Each)`, `Total Cost ($ M)`
- Resource summary: `Procurement Quantity (Units in Each)`, `Gross/Weapon System Cost ($ in Millions)`, `Flyaway Unit Cost ($ in Thousands)`, `Net Procurement (P-1) ($ in Millions)`, `Initial Spares ($ in Millions)`
- P-1 detail: `Ident Code`, `Sec`, `BSA`
- Distribution: `Secondary Distribution`
- Cost types: `Installation Cost`, `Cost Element Breakout`

**RDTE only (TaggedPDF):**
- R-3 fiscal: `Product Development ($ in Millions)`, `Test and Evaluation ($ in Millions)`, `Management Services ($ in Millions)`, `Support ($ in Millions)`
- COST summary: `COST ($ in Millions)`, `Cost To Complete`, `Total Cost`
- Accomplishments: `B. Accomplishments/Planned Programs ($ in Millions)`
- Index: `Budget Activity`, `OSDPE / Project`, `Project Title`
- Strategy: `Acquisition Strategy`

**MILPERS only (TaggedPDF):**
- Monthly columns: `OCT, NOV, DEC, JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP`
- Budget Activity: `BA1, BA2, BA3, BA4, BA5, BA6`
- Personnel-specific: `RESERVE PERSONNEL, ARMY`, `SCHEDULE OF INCREASES AND DECREASES`, `BAS`, `Basic Pay`, `Retired Pay`

**MILCON only (TaggedPDF):**
- Location: `State`, `State/Country`, `Installation or Location`, `Quarters ID`, `Quarters Address`
- Project: `Original Authorized Amount`
- BRAC-specific: `One-Time Implementation Costs`, `One-Time Savings`, `BRAC Continuing Environmental and Caretaker Costs`
- Historical FY: `FY 1990` through `FY 2011`

**AWCF only (TaggedPDF):**
- Working capital: `Revenue`, `Total Cost`, `QTY`, `SCL`, `Demand Based`, `Non-Demand Based`
- `Cash Plan` (25-column table)

**CAMDD only (TaggedPDF):**
- `FY 2025 Supplemental`

### Dollar Unit Summary

| Appropriation | Primary Unit | Exceptions |
|---------------|-------------|------------|
| O&M (EAS JSON) | Thousands | — |
| O&M (TaggedPDF) | Thousands | — |
| Procurement | Thousands (P-1, Appropriation Summary) | P-5 Total Cost in **Millions**, Unit Cost in **Thousands** |
| RDTE | **Millions** | — |
| MILPERS | Thousands | — |
| MILCON | Thousands | BRAC in **Millions** |
| Other Funds | Thousands | — |
| Cemeterial | Thousands | — |
| AWCF | Mixed | "$ in Thousands" and "$ in Millions" per exhibit |
| CAMDD | Thousands | — |

---

## 13. Structural Differences: JSON vs XML

### EAS JSON (2 files, O&M only)

| Feature | Detail |
|---------|--------|
| **Root structure** | `{ "Metadata": {...}, "GeneratedOutput": {...} }` |
| **Hierarchy** | Book > Book Section > Exhibit > TabStrip > Tab > Grid |
| **Children location** | `node.GeneratedOutput.Children` (document nodes) OR `node.Children` (layout nodes) |
| **Grid identification** | `node.GeneratedOutput.Type === "Grid"` |
| **Column definitions** | `Columns[]` array with `{ Code, Text, Type, Order, Group, Level }` |
| **Row definitions** | `Rows[]` array with `{ Code, Type, Cells[] }` where `Type` = data/subtotal/total/blank/header |
| **Cell values** | `{ ColumnCode, Type, Value, NarrativeData }` — Value is always string, numbers have commas |
| **Column types** | `text`, `numeric`, `dollar`, `percent` |
| **Blank columns to skip** | `Blnk1-3`, `AddRow`, `BlnkCol`, `BlnkCol_*`, `numeric`, `numeric_*`, `lvl1Col_*` |
| **Unique node types** | Book, Book Section, Exhibit, Grid, Tab, Tab Strip, Text Area, Toggle |
| **Grid codes** | Consistent per exhibit type (e.g., `OP53a`, `Op5Part3b`, `PB24CGSCFinSumm`) |
| **Implicit columns** | `Narrative` column not in definitions but referenced by cells (Part 3C1 grids) |

### TaggedPDF XML (33 files, all appropriation types)

| Feature | Detail |
|---------|--------|
| **Root structure** | `<TaggedPDF-doc> > <Document> > <Sect>` |
| **Hierarchy** | Flat: `Sect > Table > TR > TH/TD` (no exhibit/grid distinction) |
| **Table identification** | `<Table>` elements |
| **Column definitions** | **None** — columns inferred from header rows (TH cells) |
| **Row identification** | `<TR>` elements; headers = all-TH rows or TH+TD mixed rows |
| **Cell values** | Text content of `<TH>` or `<TD>` elements (via `<P>` children) |
| **Header detection** | All-TH rows = header; first TH + rest TD = data row with label |
| **Self-closing empty cells** | `<TD/>` and `<TH/>` — extremely common (40% of all cells in RDTE) |
| **Column count varies per row** | Different rows in same table can have different cell counts |
| **Multi-row headers** | FY super-header (row 1) + sub-category (row 2) with different column counts |
| **All-TH narrative tables** | Used for reconciliation text, narrative blocks — no data |
| **Element vocabulary** | `Div, Figure, H1-H6, ImageData, L, LBody, LI, Lbl, P, Part, Sect, TD, TH, TR, Table, Caption` |
| **Data in Figures** | Procurement files have budget data embedded in `<Figure>` tags as plain text |

### Word XML (1 file, National Guard O&M Overview)

| Feature | Detail |
|---------|--------|
| **Root structure** | `<pkg:package>` with `<?mso-application progid="Word.Document"?>` |
| **Table structure** | `w:tbl > w:tr > w:tc > w:p > w:r > w:t` |
| **Text fragmentation** | Text split across multiple `w:r` runs with different formatting |
| **Column widths** | Explicit via `w:gridCol w:w="..."` |
| **Cell merging** | `w:gridSpan` (horizontal) + `w:vMerge` (vertical) |
| **Header detection** | Bold text (`w:b` element) indicates header |
| **Parser support** | **NOT supported by existing `process-jbook.js`** |

---

## 14. Parser Challenges & Edge Cases

### Critical Issues

1. **Word XML format (1 file):** `National Guard Army O&M Overview.xml` is a Word document, not TaggedPDF. Needs a completely new parser or must be skipped.

2. **Severely corrupted OCR (1 file):** `National Guard Personnel Army Volume 1.xml` has character-spaced text throughout. Would need OCR cleanup preprocessing or must be skipped.

3. **Mixed dollar units:** P-5 Procurement tables have Unit Cost in Thousands and Total Cost in Millions in the same table. BRAC uses Millions. AWCF mixes. RDTE is all Millions. Parser must detect unit from header text.

4. **Data in `<Figure>` elements:** Procurement files embed P-40 Resource Summary data as plain text inside `<Figure>` tags (1,062 figures with data). `<Table>` parsing alone misses this.

5. **Implicit/missing column definitions:** 53 EAS JSON grids (Part 3C1) have 0 column definitions. Cells reference `RowText`, `Amt`, and `Narrative` columns that don't exist in the `Columns[]` array.

### Moderate Issues

6. **Column-splitting artifacts (RDTE, Procurement):** 5-10% of TaggedPDF tables have headers split mid-word across cells (e.g., `Progra | ms ($ in Millions)`). Need concatenation heuristic.

7. **Variable column counts per row:** TaggedPDF tables commonly have different numbers of cells per row. Section divider rows may have 1 cell spanning full width while data rows have 8-14.

8. **Multi-row headers with mismatched counts:** Row 1 (FY super-header) may have 4 columns while Row 2 (sub-categories) has 9. Need header combination/expansion logic.

9. **All-TH narrative tables:** Tables with no TD cells at all are used for both section headers and narrative text. Must distinguish from data tables.

10. **P-3a tables with no header row:** 238 Procurement tables (P-3a Individual Modification) are entirely TD cells with no TH row. First TD cell contains `"Exhibit P-3a"`.

11. **Upload-only exhibits (EAS JSON):** 8 of 13 Volume 2 exhibits are upload-only (Toggle with type "upload"), containing no parseable data.

12. **OCR typos (CAMDD, MILPERS):** `RDTE Titie`, `ROTE Tit1e`, `Do11ars`, `Chemicai`, `Arm:z'`, `SuEeort`

### Minor Issues

13. **Empty tables:** Several files have tables with 0 data rows (headers only). Should be skipped.

14. **Chart/photo artifacts (AWCF):** Axis labels and photo captions appear as table headers.

15. **Long narrative in headers (MILCON):** Entire project descriptions embedded in TH cells.

16. **Historical FY columns (BRAC):** FY 1990 through FY 2011 — far outside normal FY 2024-2030 range.

17. **Text Area node type (EAS JSON):** 107 instances in Volume 1, not documented in original CLAUDE.md. Contains no grids.

18. **New column type `dollar` (EAS JSON):** Distinct from `numeric`. Appears in 3A Combined Grid and Part 3C1 Grid.

---

*End of Schema Reference*
