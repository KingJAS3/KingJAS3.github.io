/**
 * scripts/process-jbook.js
 *
 * Processes EAS JSON budget data into dashboard-ready JSON files.
 * Input:  fy2026_budget/Army/Operation and Maintenance/Regular Army Operation and Maintenance Volume 1.json
 * Output: public/data/army-om-vol1.json + public/data/index.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "data");
const INPUT_FILE = join(
  ROOT,
  "fy2026_budget",
  "Army",
  "Operation and Maintenance",
  "Regular Army Operation and Maintenance Volume 1.json"
);

// Column codes that are display-only headers (skip in data extraction)
const SKIP_COLS = new Set([
  "TotaObliAuthDollInTh",
  "PyHeader",
  "ThouHeader",
  "RateHeader",
  "text",
  "numeric",
  "numeric_1",
]);

// Column codes that contain text labels (not dollar amounts)
const TEXT_COLS = new Set([
  "RowText",
  "BudgActi",
  "LineItem",
  "Line",
  "ProgElem",
  "Sort",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a comma-formatted numeric string to a JS number. */
function parseNum(val) {
  if (val == null || val === "") return null;
  const cleaned = String(val).replace(/,/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

/** Unwrap a document entity node (Book, Book Section, Exhibit). */
function unwrap(node) {
  if (node.Metadata && node.GeneratedOutput) {
    return node.GeneratedOutput;
  }
  return node;
}

/** Get children from a node, checking both locations. */
function getChildren(node) {
  const inner = unwrap(node);
  // Document entities: children on GeneratedOutput
  if (node.GeneratedOutput && node.GeneratedOutput.Children) {
    return node.GeneratedOutput.Children;
  }
  // UI nodes (Tab Strip, Tab, Grid): children directly on node
  if (node.Children) return node.Children;
  return [];
}

/** Get display name/type/code from a node. */
function nodeInfo(node) {
  const inner = unwrap(node);
  return {
    name: inner.Name || node.Name || "",
    type: inner.Type || node.Type || "",
    code: inner.Code || node.Code || "",
    description: inner.Description || node.Description || "",
  };
}

// ---------------------------------------------------------------------------
// Grid processing
// ---------------------------------------------------------------------------

/**
 * Convert a Grid node's Columns + Rows into an array of plain objects.
 * Only includes data rows (skips blank, total, subtotal, header).
 */
function processGrid(gridNode) {
  const columns = gridNode.Columns || [];
  const rows = gridNode.Rows || [];

  // Build column map: code → { code, text, type, order }
  const colDefs = columns
    .filter((c) => !SKIP_COLS.has(c.Code))
    .map((c) => ({
      code: c.Code,
      text: (c.Text || "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim(),
      type: c.Type,
      order: c.Order || 0,
    }))
    .sort((a, b) => a.order - b.order);

  // For grids with 0 defined columns (like OP5Part3C1), build implicit columns
  // from the ColumnCodes referenced in cells
  let implicitCols = false;
  if (colDefs.length === 0) {
    const seenCodes = new Set();
    for (const row of rows) {
      for (const cell of row.Cells || []) {
        if (!SKIP_COLS.has(cell.ColumnCode)) {
          seenCodes.add(cell.ColumnCode);
        }
      }
    }
    // Exclude Narrative column from data output (it's long text)
    seenCodes.delete("Narrative");
    for (const code of seenCodes) {
      colDefs.push({
        code,
        text: code === "RowText" ? "" : code === "Amt" ? "Amount" : code,
        type: code === "RowText" ? "text" : "numeric",
        order: code === "RowText" ? 0 : 1,
      });
    }
    colDefs.sort((a, b) => a.order - b.order);
    implicitCols = true;
  }

  // Process rows.
  // Track current Budget Activity from header rows so we can inject it
  // into data rows (header rows have text like "Budget Activity 01: Operating Forces").
  // For most grids, only "data" rows are kept. For grids that have hierarchical
  // structure (total/subtotal as section headers), preserve all non-blank rows
  // with their type so the UI can render indentation.
  const hasHierarchy = rows.some((r) => r.Type === "subtotal" || r.Type === "total");
  const keepAllTypes = hasHierarchy;

  const dataRows = [];
  let currentBA = "";
  let currentAG = "";
  for (const row of rows) {
    if (row.Type === "header") {
      const rtCell = (row.Cells || []).find((c) => c.ColumnCode === "RowText");
      if (rtCell) {
        const m = (rtCell.Value || "").match(
          /Budget Activity (\d+):\s*(.+)/i
        );
        if (m) {
          currentBA = m[1].padStart(2, "0");
          currentAG = ""; // reset AG when BA changes
        }
      }
      // For grids with hierarchy, keep header rows too (e.g., PB31D section headers)
      if (!keepAllTypes) continue;
    }
    // Track Activity Group from subtotal rows (e.g., "Land Forces", "Logistics Operations")
    // but not from "TOTAL BA" rows
    if (row.Type === "subtotal") {
      const rtCell = (row.Cells || []).find((c) => c.ColumnCode === "RowText");
      if (rtCell && rtCell.Value) {
        currentAG = rtCell.Value.trim();
      }
    }
    if (row.Type === "blank") continue;
    if (!keepAllTypes && row.Type !== "data") continue;

    const obj = {};
    for (const cell of row.Cells || []) {
      const colCode = cell.ColumnCode;
      if (SKIP_COLS.has(colCode)) continue;
      if (colCode === "Narrative") continue; // skip long narrative text

      if (TEXT_COLS.has(colCode)) {
        obj[colCode] = cell.Value || "";
      } else if (
        cell.Type === "numeric" ||
        cell.Type === "dollar" ||
        cell.Type === "percent"
      ) {
        obj[colCode] = parseNum(cell.Value);
      } else if (cell.Type === "text") {
        obj[colCode] = cell.Value || "";
      } else {
        // Default: try to parse as number, fall back to string
        const num = parseNum(cell.Value);
        obj[colCode] = num !== null ? num : cell.Value || "";
      }
    }

    // Inject BudgActi and ActivityGroup if the column exists but the cell was empty/missing
    if (
      currentBA &&
      colDefs.some((c) => c.code === "BudgActi") &&
      !obj.BudgActi
    ) {
      obj.BudgActi = currentBA;
    }
    if (currentAG && row.Type === "data") {
      obj._ag = currentAG;
    }

    // Preserve row type for hierarchical grids
    if (keepAllTypes && row.Type !== "data") {
      obj._rowType = row.Type;
    }
    // Also tag header rows
    if (row.Type === "header") {
      obj._rowType = "header";
    }

    dataRows.push(obj);
  }

  return {
    columns: colDefs,
    rows: dataRows,
    implicitCols,
  };
}

// ---------------------------------------------------------------------------
// Tree walk — collect all grids with hierarchy path
// ---------------------------------------------------------------------------

function walkTree(node, pathParts, results) {
  const info = nodeInfo(node);

  if (info.type === "Toggle" || info.type === "Text Area") {
    return; // Skip narrative-only nodes
  }

  if (info.type === "Grid") {
    const rows = node.Rows || [];
    const dataRowCount = rows.filter((r) => r.Type === "data").length;
    if (dataRowCount === 0) return; // Skip empty grids

    const processed = processGrid(node);
    if (processed.rows.length === 0) return;

    results.push({
      path: pathParts.map((p) => p.name),
      pathCodes: pathParts.map((p) => p.code).filter(Boolean),
      gridName: info.name,
      gridCode: info.code,
      columns: processed.columns,
      rows: processed.rows,
    });
    return;
  }

  // Build path entry for this node (skip Tab Strip and Tab — they're just UI wrappers)
  const skipInPath =
    info.type === "Tab Strip" ||
    info.type === "Tab" ||
    info.type === "Book"; // Root Book is implicit
  const nextPath = skipInPath
    ? pathParts
    : [
        ...pathParts,
        {
          name: info.description || info.name,
          code: info.code,
          type: info.type,
        },
      ];

  const children = getChildren(node);
  for (const child of children) {
    walkTree(child, nextPath, results);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // Ensure output directory exists
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  // Check for input file
  if (!existsSync(INPUT_FILE)) {
    console.log(
      "⚠  Input file not found — skipping processing.",
      "\n   Expected:", INPUT_FILE
    );
    console.log("   (This is normal on deploy machines without raw data.)");
    return;
  }

  console.log("Reading input file...");
  const raw = readFileSync(INPUT_FILE, "utf8");
  const data = JSON.parse(raw);

  console.log("Walking tree...");
  const grids = [];
  walkTree(data, [], grids);

  console.log(`Found ${grids.length} grids with data.`);

  // Build output structure organized by hierarchy
  const output = {
    metadata: {
      source: "Regular Army Operation and Maintenance Volume 1",
      service: "Army",
      appropriation: "Operation & Maintenance",
      budgetYear: "FY2026",
      dollarUnit: "thousands",
      generatedAt: new Date().toISOString(),
    },
    grids: grids,
  };

  // Stats
  let totalRows = 0;
  for (const g of grids) totalRows += g.rows.length;
  console.log(`Total data rows: ${totalRows}`);

  // Write output
  const outPath = join(OUT_DIR, "army-om-vol1.json");
  writeFileSync(outPath, JSON.stringify(output));
  const sizeMB = (Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${outPath} (${sizeMB} MB)`);

  // Write index.json
  const index = {
    documents: [
      {
        id: "army-om-vol1",
        service: "Army",
        appropriation: "Operation & Maintenance",
        label: "Regular Army O&M Volume 1",
        file: "army-om-vol1.json",
      },
    ],
  };
  const indexPath = join(OUT_DIR, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`Wrote ${indexPath}`);

  console.log("Done.");
}

main();
