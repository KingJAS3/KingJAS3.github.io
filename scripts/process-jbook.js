/**
 * scripts/process-jbook.js
 *
 * Processes EAS JSON budget data into dashboard-ready JSON files.
 * Input:  fy2026_budget/ (multiple documents)
 * Output: public/data/<id>.json + public/data/index.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "data");

const DOCUMENTS = [
  {
    input: join(ROOT, 'fy2026_budget', 'Army', 'Operation and Maintenance',
      'Regular Army Operation and Maintenance Volume 1.json'),
    id: 'army-om-vol1',
    outputFile: 'army-om-vol1.json',
    label: 'Regular Army O&M Volume 1',
    source: 'Regular Army Operation and Maintenance Volume 1',
    service: 'Army',
    appropriation: 'Operation & Maintenance',
  },
  {
    input: join(ROOT, 'fy2026_budget', 'Army', 'Operation and Maintenance',
      'Regular Army Operation and Maintenance Volume 2.json'),
    id: 'army-om-vol2',
    outputFile: 'army-om-vol2.json',
    label: 'Regular Army O&M Volume 2',
    source: 'Regular Army Operation and Maintenance Volume 2',
    service: 'Army',
    appropriation: 'Operation & Maintenance',
  },
];

// Column codes that are display-only headers (skip in data extraction)
const SKIP_COLS = new Set([
  "TotaObliAuthDollInTh",
  "PyHeader",
  "ThouHeader",
  "RateHeader",
  "FyPy",
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

/** Strip HTML tags and decode common entities to plain text. */
function stripHtmlToPlain(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&sect;/g, "\u00A7")
    .replace(/&bull;/g, "\u2022")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract text from a base64-encoded DOCX (ZIP containing word/document.xml). */
function extractTextFromDocxBase64(base64Str) {
  const buf = Buffer.from(base64Str, "base64");
  const zip = new AdmZip(buf);
  const docEntry = zip.getEntry("word/document.xml");
  if (!docEntry) return "";
  const xml = docEntry.getData().toString("utf8");
  const texts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    texts.push(m[1]);
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

/** Extract structured force structure data from a base64-encoded DOCX.
 *  Parses paragraph boundaries (<w:p>) and bold runs (<w:b/>) to produce
 *  the same { intro, sections } shape as parseForceStructureHtml(). */
function extractStructuredFromDocxBase64(base64Str) {
  const buf = Buffer.from(base64Str, "base64");
  const zip = new AdmZip(buf);
  const docEntry = zip.getEntry("word/document.xml");
  if (!docEntry) return null;
  const xml = docEntry.getData().toString("utf8");

  // Parse paragraphs: each <w:p>...</w:p> is a line
  const paragraphs = [];
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let pm;
  while ((pm = paraRe.exec(xml)) !== null) {
    const paraXml = pm[0];
    // Check if any run in this paragraph is bold
    const hasBold = /<w:b\s*\/?>/.test(paraXml);
    // Extract all text runs
    const texts = [];
    const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tm;
    while ((tm = tRe.exec(paraXml)) !== null) {
      texts.push(tm[1]);
    }
    const text = texts.join("").trim();
    if (text) {
      paragraphs.push({ text, bold: hasBold });
    }
  }

  if (paragraphs.length === 0) return null;

  // Check if any bold paragraphs exist — if not, fall back to plain text
  const hasBoldHeadings = paragraphs.some((p) => p.bold);
  if (!hasBoldHeadings) {
    return { intro: paragraphs.map((p) => p.text).join("\n"), sections: [] };
  }

  // Group into intro + sections
  const intro = [];
  const sections = [];
  let currentSection = null;

  for (const p of paragraphs) {
    if (p.bold) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: p.text, items: [] };
    } else if (currentSection) {
      currentSection.items.push(p.text);
    } else {
      intro.push(p.text);
    }
  }
  if (currentSection) sections.push(currentSection);

  return { intro: intro.join("\n"), sections };
}

/** Decode HTML entities (shared with stripHtmlToPlain). */
function decodeHtmlEntities(html) {
  return html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&sect;/g, "\u00A7")
    .replace(/&bull;/g, "\u2022")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Parse force structure HTML into structured { intro, sections } format.
 *  Detects <strong> tags as section headings and <br> as line separators. */
function parseForceStructureHtml(html) {
  let text = decodeHtmlEntities(html);

  // Merge consecutive <strong> tags (e.g., <strong>Direct Reporting </strong><strong>Units:</strong>)
  text = text.replace(/<\/strong>\s*<strong>/gi, "");

  // Remove <br> tags inside <strong> (they're visual line breaks in headings)
  text = text.replace(/<strong>([\s\S]*?)<\/strong>/gi, (_, inner) => {
    return "<strong>" + inner.replace(/<br\s*\/?>/gi, " ") + "</strong>";
  });

  // Replace <br> / <br /> with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Replace </p> with double newlines
  text = text.replace(/<\/p>/gi, "\n\n");

  // Tokenize: walk through the text and classify each chunk as heading or plain text
  const tokens = []; // { type: 'heading'|'text', value: string }
  const strongRe = /<strong>([\s\S]*?)<\/strong>/gi;
  let lastIndex = 0;
  let sm;
  while ((sm = strongRe.exec(text)) !== null) {
    // Plain text before this <strong>
    if (sm.index > lastIndex) {
      const before = text.substring(lastIndex, sm.index).replace(/<[^>]+>/g, "");
      tokens.push({ type: "text", value: before });
    }
    const hText = sm[1].replace(/<[^>]+>/g, "").trim();
    if (hText) tokens.push({ type: "heading", value: hText });
    lastIndex = sm.index + sm[0].length;
  }
  // Trailing text after last <strong>
  if (lastIndex < text.length) {
    const after = text.substring(lastIndex).replace(/<[^>]+>/g, "");
    tokens.push({ type: "text", value: after });
  }

  // Check if we found any headings
  const hasHeadings = tokens.some((t) => t.type === "heading");
  if (!hasHeadings) {
    const plain = tokens
      .map((t) => t.value)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return plain ? { intro: plain, sections: [] } : null;
  }

  // Group into intro + sections
  const introLines = [];
  const sections = [];
  let currentSection = null;

  for (const tok of tokens) {
    if (tok.type === "heading") {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: tok.value, items: [] };
    } else {
      const lines = tok.value
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (currentSection) {
        currentSection.items.push(...lines);
      } else {
        introLines.push(...lines);
      }
    }
  }
  if (currentSection) sections.push(currentSection);

  return { intro: introLines.join("\n"), sections };
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

function walkTree(node, pathParts, results, narratives, forceStructure) {
  const info = nodeInfo(node);

  // Capture Part 1 "Description of Operations Financed" narrative text
  if (info.type === "Toggle" && info.name === "Part 1 Toggle") {
    const textObj = node.Text || {};
    const html = typeof textObj === "string" ? textObj : textObj.Value || "";
    let plain = html ? stripHtmlToPlain(html) : "";

    // Fallback: extract from embedded DOCX upload
    if (!plain && node.Uploads && node.Uploads.length > 0) {
      const upload = node.Uploads[0];
      if (upload.ByteArray) {
        plain = extractTextFromDocxBase64(upload.ByteArray);
      }
    }

    const sagCode = pathParts.map((p) => p.code).filter(Boolean).find((c) => c.startsWith("SAG"));
    if (sagCode && plain) {
      narratives[sagCode] = plain;
    }
    return;
  }

  // Capture Part 2 "Force Structure Summary" narrative text
  if (info.type === "Toggle" && info.name === "Part 2 Toggle") {
    const textObj = node.Text || {};
    const html = typeof textObj === "string" ? textObj : textObj.Value || "";
    let structured = html ? parseForceStructureHtml(html) : null;

    // Fallback: extract structured data from embedded DOCX upload
    if (!structured && node.Uploads && node.Uploads.length > 0) {
      const upload = node.Uploads[0];
      if (upload.ByteArray) {
        structured = extractStructuredFromDocxBase64(upload.ByteArray);
      }
    }

    const sagCode = pathParts.map((p) => p.code).filter(Boolean).find((c) => c.startsWith("SAG"));
    if (sagCode && structured) {
      forceStructure[sagCode] = structured;
    }
    return;
  }

  if (info.type === "Toggle" || info.type === "Text Area") {
    return; // Skip other narrative-only nodes
  }

  if (info.type === "Grid") {
    const rows = node.Rows || [];
    const meaningfulRowCount = rows.filter((r) => r.Type !== "blank").length;
    if (meaningfulRowCount === 0) return; // Skip empty grids

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
    walkTree(child, nextPath, results, narratives, forceStructure);
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

  const catalogEntries = [];

  for (const doc of DOCUMENTS) {
    // Check for input file
    if (!existsSync(doc.input)) {
      console.log(`⚠  ${doc.label}: input file not found — skipping.`);
      console.log(`   Expected: ${doc.input}`);
      continue;
    }

    console.log(`\nProcessing ${doc.label}...`);
    const raw = readFileSync(doc.input, "utf8");
    const data = JSON.parse(raw);

    console.log("Walking tree...");
    const grids = [];
    const narratives = {};
    const forceStructure = {};
    walkTree(data, [], grids, narratives, forceStructure);

    console.log(`Found ${grids.length} grids with data.`);
    console.log(`Found ${Object.keys(narratives).length} Part 1 narratives.`);
    console.log(`Found ${Object.keys(forceStructure).length} Part 2 force structure summaries.`);

    // Build output structure organized by hierarchy
    const output = {
      metadata: {
        source: doc.source,
        service: doc.service,
        appropriation: doc.appropriation,
        budgetYear: "FY2026",
        dollarUnit: "thousands",
        generatedAt: new Date().toISOString(),
      },
      grids: grids,
      narratives: narratives,
      forceStructure: forceStructure,
    };

    // Stats
    let totalRows = 0;
    for (const g of grids) totalRows += g.rows.length;
    console.log(`Total data rows: ${totalRows}`);

    // Write output
    const outPath = join(OUT_DIR, doc.outputFile);
    writeFileSync(outPath, JSON.stringify(output));
    const sizeMB = (Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(2);
    console.log(`Wrote ${outPath} (${sizeMB} MB)`);

    catalogEntries.push({
      id: doc.id,
      service: doc.service,
      appropriation: doc.appropriation,
      label: doc.label,
      file: doc.outputFile,
    });
  }

  if (catalogEntries.length === 0) {
    console.log("\n⚠  No documents processed. (This is normal on deploy machines without raw data.)");
    return;
  }

  // Write index.json
  const index = { documents: catalogEntries };
  const indexPath = join(OUT_DIR, "index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`\nWrote ${indexPath} (${catalogEntries.length} documents)`);

  console.log("Done.");
}

main();
