#!/usr/bin/env node
/**
 * Sync the publishable Obsidian vault into the Eleventy site.
 *
 * The vault is the single source of truth. This mirrors its folder structure
 * 1:1 into `src/www/` (so site URLs follow vault folders), converting Obsidian
 * syntax (callouts, tallies, image embeds, wikilinks) on the way through.
 *
 * Rules:
 *   - Skip any path segment starting with `_` or `.` (private: `_system`,
 *     `_mechanics`, `.obsidian`, …). `secrets/` publishes.
 *   - Skip any note whose front matter sets `publish: false`.
 *   - Idempotent: every generated file from the previous run is removed first,
 *     so vault deletions/renames propagate. Hand-authored files (index.njk,
 *     layouts, theme assets) are never touched.
 *
 * Usage:   npm run sync
 * Vault:   D:\Personal\Dropbox\Notebook\Writing\Tag And Tally\The Mind of Nox
 *          override with NOX_VAULT_DIR.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slugify from "slugify";
import {
  splitFrontMatter,
  parseFrontMatter,
  firstHeading,
  convertBody,
  yamlQuote,
} from "./lib/convert.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..");
const WWW_DIR = path.join(PROJECT_DIR, "src", "www");
const IMAGES_OUT = path.join(PROJECT_DIR, "src", "assets", "images", "vault");
const MANIFEST = path.join(__dirname, ".sync-manifest.json");
const IMAGE_BASE = "/images/vault/";

const VAULT_DIR =
  process.env.NOX_VAULT_DIR ??
  "D:\\Personal\\Dropbox\\Notebook\\Writing\\Tag And Tally\\The Mind of Nox";

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg)$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DOTTED_DATE_RE = /^(\d{4})\.(\d{2})\.(\d{2})$/;

// ---------- small helpers ----------

const isPrivateSegment = (seg) => /^[._]/.test(seg);

/** URL/file-safe slug for one path segment (keeps dotted dates as 2026-06-21). */
function slugSegment(seg) {
  return seg
    .toLowerCase()
    .replace(/[._\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Human-readable title from a filename stem (drops leading numbering). */
function humanizeStem(stem) {
  const cleaned = stem
    .replace(/^\d+[a-z]?[-_.\s]*/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned || stem.replace(/[-_]+/g, " ").trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Resolve a YYYY-MM-DD date from front matter or a dotted-date filename. */
function resolveDate(fm, stem) {
  for (const key of ["timestamp", "date"]) {
    const v = fm.get(key);
    if (typeof v === "string" && ISO_DATE_RE.test(v.trim())) return v.trim();
  }
  const m = stem.match(DOTTED_DATE_RE);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Recursively list files under `dir`, honouring the private-segment skip rule. */
function walkPublishable(dir, relParts, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (isPrivateSegment(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPublishable(abs, [...relParts, entry.name], out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push({ abs, relParts: [...relParts, entry.name] });
    }
  }
}

/** Index every image file in the vault (filename → absolute path) for embed copy-out. */
function indexImages(dir, index, warn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue; // skip .obsidian etc.
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      indexImages(abs, index, warn);
    } else if (entry.isFile() && IMAGE_EXT_RE.test(entry.name)) {
      if (index.has(entry.name) && index.get(entry.name) !== abs) {
        warn.push(`duplicate image name "${entry.name}" — using first match`);
      } else {
        index.set(entry.name, abs);
      }
    }
  }
}

// ---------- manifest (idempotent cleanup) ----------

function readManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    return Array.isArray(parsed.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

const STOP_DIRS = new Set([WWW_DIR, IMAGES_OUT, PROJECT_DIR]);

/** Delete a file, then remove now-empty parent dirs up to a stop boundary. */
function deleteAndPrune(absPath) {
  if (fs.existsSync(absPath)) fs.rmSync(absPath);
  let dir = path.dirname(absPath);
  // Only prune within the two output roots; never climb past a stop dir.
  while (
    !STOP_DIRS.has(dir) &&
    (dir.startsWith(WWW_DIR + path.sep) || dir.startsWith(IMAGES_OUT + path.sep))
  ) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) break;
    if (fs.existsSync(dir)) fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

// ---------- wikilink resolution ----------

/** Slug for a heading anchor — must match the site's `slugify` filter / heading ids. */
function slugAnchor(text) {
  return slugify(String(text), { lower: true, strict: true, replacement: "-" });
}

/** Site URL for a note's slugged destination dirs + name (Eleventy default permalink). */
function urlFor(slugDirs, slugName) {
  return `/${[...slugDirs, slugName].join("/")}/`;
}

/**
 * Build a wikilink resolver from the registered notes. Resolves Obsidian-style
 * targets (`Note`, `folder/Note`, `Note#Heading`, `#Heading`) to site URLs,
 * mirroring Obsidian's basename-anywhere lookup. Returns null when unresolved.
 */
function buildResolver(byPath, byName) {
  return function resolveLink(rawTarget) {
    const [pathRaw, ...headingParts] = rawTarget.split("#");
    const pathPart = pathRaw.trim().replace(/\\/g, "/").replace(/\.md$/i, "");
    const heading = headingParts.map((h) => h.trim()).filter(Boolean).pop();
    const anchor = heading && !heading.startsWith("^") ? `#${slugAnchor(heading)}` : "";

    // `[[#Heading]]` — same-page anchor.
    if (pathPart === "") return anchor || null;

    const key = pathPart.toLowerCase();
    let url = byPath.get(key);
    if (!url) {
      const leaf = key.split("/").filter(Boolean).pop() ?? key;
      const matches = byName.get(leaf);
      if (matches && matches.length) {
        // Prefer the shortest path on an ambiguous bare name (Obsidian-ish).
        url = matches.slice().sort((a, b) => a.depth - b.depth)[0].url;
      }
    }
    return url ? `${url}${anchor}` : null;
  };
}

// ---------- generation ----------

function buildFrontMatter({ layout, title, date, section, fm }) {
  const lines = ["---", `layout: ${layout}`, `title: ${yamlQuote(title)}`];
  if (date) lines.push(`date: ${date}`);
  lines.push(`section: ${yamlQuote(section)}`);
  lines.push("vault: true");
  const tags = fm.get("tags");
  if (Array.isArray(tags) && tags.length) {
    lines.push(`tags: [${tags.join(", ")}]`);
  }
  const session = fm.get("session");
  if (typeof session === "number") lines.push(`session: ${session}`);
  const character = fm.get("character");
  if (typeof character === "string" && character.trim()) {
    lines.push(`character: ${yamlQuote(character.trim())}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function main() {
  if (!fs.existsSync(VAULT_DIR)) {
    console.error(`Vault directory does not exist:\n  ${VAULT_DIR}`);
    console.error("Set NOX_VAULT_DIR to override.");
    process.exit(1);
  }

  const warnings = [];

  // 1. Clean previous output.
  for (const rel of readManifest()) {
    deleteAndPrune(path.join(PROJECT_DIR, rel));
  }

  // 2. Build the vault image index (covers `_images/` and module images).
  const imageIndex = new Map();
  indexImages(VAULT_DIR, imageIndex, warnings);

  // 3. Walk publishable notes.
  const notes = [];
  walkPublishable(VAULT_DIR, [], notes);

  // --- Pass 1: resolve each note's destination + register link keys. ---
  const records = [];
  const byPath = new Map(); // "lore/npcs" → url
  const byName = new Map(); // "npcs" → [{ url, depth }]
  const usedDests = new Map();
  let skipped = 0;

  for (const note of notes) {
    const text = fs.readFileSync(note.abs, "utf8");
    const { frontMatterRaw, body, hasFrontMatter } = splitFrontMatter(text);
    const fm = hasFrontMatter ? parseFrontMatter(frontMatterRaw) : new Map();
    if (fm.get("publish") === false) {
      skipped++;
      continue;
    }

    const relPosix = note.relParts.join("/");
    const stem = note.relParts[note.relParts.length - 1].replace(/\.md$/i, "");
    const dirParts = note.relParts.slice(0, -1);

    // Root-level notes (e.g. the vault's `index.md` hub) would land at the site
    // root and clobber the hand-authored homepage. The homepage is generated
    // from collections instead — skip them.
    if (dirParts.length === 0) {
      warnings.push(`skipped root-level note (homepage is generated): ${relPosix}`);
      continue;
    }

    const slugDirs = dirParts.map(slugSegment);
    const slugName = slugSegment(stem) || "untitled";
    const destRel = path.join("src", "www", ...slugDirs, `${slugName}.md`);

    if (usedDests.has(destRel)) {
      warnings.push(
        `slug collision: "${relPosix}" and "${usedDests.get(destRel)}" → ${destRel} (skipped)`,
      );
      continue;
    }
    usedDests.set(destRel, relPosix);

    const url = urlFor(slugDirs, slugName);
    // Register link keys: full relative path (no ext) + bare basename, lowercased.
    const pathKey = note.relParts.join("/").replace(/\.md$/i, "").toLowerCase();
    byPath.set(pathKey, url);
    const nameKey = stem.toLowerCase();
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push({ url, depth: note.relParts.length });

    records.push({ note, fm, body, relPosix, stem, slugDirs, slugName, destRel });
  }

  // --- Pass 2: convert bodies (resolving wikilinks) + write. ---
  const resolveLink = buildResolver(byPath, byName);
  const generated = []; // project-relative paths, for the manifest
  const copiedImages = new Set();

  for (const rec of records) {
    const { note, fm, body, relPosix, stem, slugDirs, slugName, destRel } = rec;
    const destAbs = path.join(PROJECT_DIR, destRel);

    const isSession =
      relPosix.startsWith("chorari-ledger/daybook/") ||
      (Array.isArray(fm.get("tags")) && fm.get("tags").includes("session"));
    const layout = isSession ? "session.njk" : "page.njk";

    const title =
      (typeof fm.get("title") === "string" && fm.get("title").trim()) ||
      firstHeading(body) ||
      humanizeStem(stem);
    const date = resolveDate(fm, stem);
    const section = slugDirs[0] ?? slugName;

    const { body: converted, referenced } = convertBody(body, {
      imageBase: IMAGE_BASE,
      resolveLink,
    });

    // Copy referenced images out of the vault.
    for (const file of referenced) {
      if (copiedImages.has(file)) continue;
      const src = imageIndex.get(file);
      if (!src) {
        warnings.push(`missing image "${file}" referenced by ${relPosix}`);
        continue;
      }
      const outAbs = path.join(IMAGES_OUT, file);
      fs.mkdirSync(IMAGES_OUT, { recursive: true });
      fs.copyFileSync(src, outAbs);
      copiedImages.add(file);
      generated.push(path.relative(PROJECT_DIR, outAbs));
    }

    const frontMatter = buildFrontMatter({ layout, title, date, section, fm });
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.writeFileSync(destAbs, frontMatter + converted, "utf8");
    generated.push(destRel);
  }

  // 4. Persist the manifest for next run's cleanup.
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify({ files: generated }, null, 2),
    "utf8",
  );

  const pages = generated.filter((p) => p.endsWith(".md")).length;
  console.log(`Synced ${pages} page(s), ${copiedImages.size} image(s).`);
  if (skipped) console.log(`Skipped ${skipped} note(s) with publish: false.`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
}

main();
