#!/usr/bin/env node
/**
 * Publish a field-notes draft from the source-of-truth Obsidian vault into
 * src/www/posts/, converting Obsidian callouts and tally code-spans into the
 * site's `sentence` and `tally` shortcodes. Stamps `published: true` (and any
 * derived case fields) back on the source file so it disappears from the next
 * run's list.
 *
 * Usage:
 *   npm run publish
 *
 * Source dir: /mnt/d/Personal/Dropbox/Notebook/Writing/Tag And Tally/The Mind of Nox/field-notes
 *   override with NOX_SOURCE_DIR env var.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, "..", "src", "www", "posts");
const SOURCE_DIR =
  process.env.NOX_SOURCE_DIR ??
  "/mnt/d/Personal/Dropbox/Notebook/Writing/Tag And Tally/The Mind of Nox/field-notes";

const FILENAME_RE = /^log-([A-Za-z0-9]{2,12})-(\d+)\.(\d+)\.md$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- tiny YAML helpers ----------

/** Splits a file into `{ frontMatterRaw, body, hasFrontMatter }`. */
function splitFrontMatter(text) {
  if (!text.startsWith("---")) {
    return { frontMatterRaw: "", body: text, hasFrontMatter: false };
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return { frontMatterRaw: "", body: text, hasFrontMatter: false };
  }
  // Skip the closing `---` line (and trailing newline if present).
  const afterClose = text.indexOf("\n", end + 1);
  const bodyStart = afterClose === -1 ? text.length : afterClose + 1;
  const frontMatterRaw = text.slice(4, end); // between leading `---\n` and `\n---`
  const body = text.slice(bodyStart);
  return { frontMatterRaw, body, hasFrontMatter: true };
}

/**
 * Parses the limited YAML shapes our source files use:
 *   key: scalar
 *   tags: [a, b]
 *   tags:
 *     - a
 *     - b
 *   key: true|false|number
 * Returns a Map (preserves insertion order) of key → value (string | string[] | boolean | number).
 */
function parseFrontMatter(raw) {
  const out = new Map();
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2];
    if (rest === "") {
      // block list?
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s+-\s+/, "").trim());
        j++;
      }
      out.set(key, items);
      i = j;
      continue;
    }
    out.set(key, coerceScalar(rest));
    i++;
  }
  return out;
}

function coerceScalar(raw) {
  const v = raw.trim();
  if (/^\[.*\]$/.test(v)) {
    return v
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number.parseInt(v, 10);
  // Strip surrounding single/double quotes if present.
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

/** Serialises a key/value back to a single YAML line (or block) in our limited dialect. */
function serializeEntry(key, val) {
  if (Array.isArray(val)) {
    if (val.length === 0) return `${key}: []`;
    // Use inline form for tags (matches existing source style).
    const inline = `[${val.join(", ")}]`;
    return `${key}: ${inline}`;
  }
  if (typeof val === "boolean") return `${key}: ${val}`;
  if (typeof val === "number") return `${key}: ${val}`;
  return `${key}: ${val}`;
}

function rebuildFrontMatter(map) {
  const lines = [];
  for (const [key, val] of map) {
    lines.push(serializeEntry(key, val));
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

// ---------- conversions ----------

/**
 * Convert Obsidian callouts (`> [!type] Title` + continuation lines starting with `>`)
 * to paired `{% sentence "type", "title" %}…{% endsentence %}` blocks.
 */
function convertCallouts(body) {
  const lines = body.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const head = line.match(/^>\s*\[!([A-Za-z0-9_-]+)\]\s*(.*)$/);
    if (!head) {
      out.push(line);
      i++;
      continue;
    }
    const type = head[1].toLowerCase();
    const title = head[2].trim();
    const innerLines = [];
    let j = i + 1;
    // Absorb body lines until a blank line or a sibling callout marker. Lines starting
    // with `>` are stripped; non-`>` lines are taken as lazy continuation (matches
    // common Obsidian authoring slips where the `>` is missing on a continuation line).
    while (j < lines.length) {
      const next = lines[j];
      if (next.trim() === "") {
        j++;
        break;
      }
      if (/^>\s*\[!/.test(next)) {
        break;
      }
      if (next.startsWith(">")) {
        innerLines.push(next.replace(/^>\s?/, ""));
      } else {
        innerLines.push(next.replace(/^\s+/, ""));
      }
      j++;
    }
    // Trim leading/trailing blank lines inside the block (defensive).
    while (innerLines.length && !innerLines[0].trim()) innerLines.shift();
    while (innerLines.length && !innerLines[innerLines.length - 1].trim()) {
      innerLines.pop();
    }
    if (type === "ai") {
      // AI callouts → paired `note` (paper variant, multi-line body preserved).
      const escTitle = escapeQuotes(title);
      const open = title
        ? `{% note "ai", "${escTitle}" %}`
        : `{% note "ai" %}`;
      out.push(open);
      out.push(...innerLines);
      out.push(`{% endnote %}`);
    } else {
      // All other callouts → inline `sentence` (sticky note, single-string body).
      // Strip Obsidian-style `\[`/`\]` escapes; collapse to one line.
      const bodyText = innerLines
        .join(" ")
        .replace(/\\\[/g, "[")
        .replace(/\\\]/g, "]")
        .replace(/\s+/g, " ")
        .trim();
      const escBody = escapeQuotes(bodyText);
      out.push(`{% sentence "${type}", "${escBody}" %}`);
    }
    i = j;
  }
  return out.join("\n");
}

function escapeQuotes(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Convert `` `boxes:N/M` `` (and `circles`, `clocks`) to `{% tally "type", N, M %}`. */
function convertTallies(body) {
  return body.replace(
    /`\s*(boxes|circles|clocks)\s*:\s*(\d+)\s*\/\s*(\d+)\s*`/g,
    (_m, type, current, total) => `{% tally "${type}", ${current}, ${total} %}`,
  );
}

/** Strip Obsidian wikilinks: `[[target|display]]` → `display`, `[[target]]` → `target`. */
function stripWikilinks(body) {
  return body.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_m, target, display) => (display ?? target).trim(),
  );
}

// ---------- main flow ----------

function listDrafts() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory does not exist:\n  ${SOURCE_DIR}`);
    console.error("Set NOX_SOURCE_DIR to override.");
    process.exit(1);
  }
  const entries = fs
    .readdirSync(SOURCE_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();

  const drafts = [];
  for (const filename of entries) {
    const full = path.join(SOURCE_DIR, filename);
    const text = fs.readFileSync(full, "utf8");
    const { frontMatterRaw, hasFrontMatter } = splitFrontMatter(text);
    const fm = hasFrontMatter ? parseFrontMatter(frontMatterRaw) : new Map();
    if (fm.get("published") === true) continue;
    drafts.push({ filename, full, fm });
  }
  return drafts;
}

function deriveCaseFromFilename(filename) {
  const m = filename.match(FILENAME_RE);
  if (!m) return null;
  return {
    caseType: m[1].toUpperCase(),
    caseNumber: Number.parseInt(m[2], 10),
    session: Number.parseInt(m[3], 10),
  };
}

function buildDestFilename(date, caseType, caseNumber, session) {
  const yy = date.slice(2, 4); // YY
  const c3 = String(caseNumber).padStart(3, "0");
  const s3 = String(session).padStart(3, "0");
  return `${date}-${yy}${caseType}-${c3}-${s3}.md`;
}

function buildDestFrontMatter({
  title,
  date,
  year,
  caseType,
  caseNumber,
  session,
}) {
  const safeTitle = String(title ?? "Field notes").replace(/"/g, '\\"');
  return [
    "---",
    "layout: post",
    `title: "${safeTitle}"`,
    `date: ${date}`,
    `year: ${year}`,
    `case_type: ${caseType}`,
    `case_number: ${caseNumber}`,
    `session: ${session}`,
    `category: Field notes`,
    "---",
    "",
  ].join("\n");
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function main() {
  const drafts = listDrafts();
  if (drafts.length === 0) {
    console.log("No unpublished drafts in:");
    console.log(`  ${SOURCE_DIR}`);
    return;
  }

  console.log(`\nUnpublished field notes (${SOURCE_DIR}):\n`);
  drafts.forEach((d, idx) => {
    const ts = d.fm.get("timestamp") ?? "(no timestamp)";
    const derived = deriveCaseFromFilename(d.filename);
    const tag = derived
      ? `${derived.caseType}-${String(derived.caseNumber).padStart(3, "0")}.${String(derived.session).padStart(3, "0")}`
      : "?";
    console.log(`  ${idx + 1}. ${d.filename}  (${ts}, ${tag})`);
  });
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const pickRaw = (await ask(rl, "Pick a number to publish (or q): ")).trim();
  rl.close();
  if (!pickRaw || pickRaw.toLowerCase() === "q") {
    console.log("Aborted.");
    return;
  }
  const pick = Number.parseInt(pickRaw, 10);
  if (
    !Number.isFinite(pick) ||
    pick < 1 ||
    pick > drafts.length
  ) {
    console.error(`Invalid choice: ${pickRaw}`);
    process.exit(1);
  }

  const draft = drafts[pick - 1];
  publishDraft(draft);
}

function publishDraft(draft) {
  const text = fs.readFileSync(draft.full, "utf8");
  const { frontMatterRaw, body, hasFrontMatter } = splitFrontMatter(text);
  const fm = hasFrontMatter ? parseFrontMatter(frontMatterRaw) : new Map();

  const timestamp = fm.get("timestamp");
  if (typeof timestamp !== "string" || !ISO_DATE_RE.test(timestamp)) {
    console.error(
      `Source is missing a YYYY-MM-DD \`timestamp\` in front matter:\n  ${draft.full}`,
    );
    process.exit(1);
  }

  // Resolve case fields: prefer YAML, else derive from filename.
  const fromName = deriveCaseFromFilename(draft.filename);
  const caseType =
    String(fm.get("case_type") ?? fromName?.caseType ?? "").toUpperCase();
  const caseNumber = Number(fm.get("case_number") ?? fromName?.caseNumber);
  const session = Number(fm.get("session") ?? fromName?.session);

  if (!caseType || !Number.isFinite(caseNumber) || !Number.isFinite(session)) {
    console.error(
      `Could not determine case_type/case_number/session from YAML or filename:\n  ${draft.full}`,
    );
    process.exit(1);
  }

  const destName = buildDestFilename(timestamp, caseType, caseNumber, session);
  const destPath = path.join(POSTS_DIR, destName);
  if (fs.existsSync(destPath)) {
    console.error(`Destination already exists, refusing to overwrite:\n  ${destPath}`);
    process.exit(1);
  }

  // Convert body: callouts first (line-based), then tallies and wikilinks (inline).
  let converted = convertCallouts(body);
  converted = convertTallies(converted);
  converted = stripWikilinks(converted);

  const yearTwo = Number.parseInt(timestamp.slice(2, 4), 10);
  const sourceTitle = fm.get("title");
  const destFm = buildDestFrontMatter({
    title: typeof sourceTitle === "string" && sourceTitle.trim() ? sourceTitle.trim() : undefined,
    date: timestamp,
    year: yearTwo,
    caseType,
    caseNumber,
    session,
  });

  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.writeFileSync(destPath, destFm + converted, "utf8");

  // Update source: ensure case fields exist + set published: true. Body untouched.
  if (!fm.has("case_type")) fm.set("case_type", caseType);
  if (!fm.has("case_number")) fm.set("case_number", caseNumber);
  if (!fm.has("session")) fm.set("session", session);
  fm.set("published", true);
  const newFmBlock = rebuildFrontMatter(fm);
  fs.writeFileSync(draft.full, newFmBlock + body, "utf8");

  console.log(`Published:`);
  console.log(`  source → ${draft.full}  (published: true)`);
  console.log(`  dest   → ${destPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
