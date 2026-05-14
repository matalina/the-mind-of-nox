#!/usr/bin/env node
/**
 * Republish a curated nox-knight page from the source-of-truth Obsidian vault
 * into src/www/nox-knight/. Same body conversions as publish-post.mjs
 * (Obsidian callouts → sentence/note shortcodes, `boxes:N/M` → tally shortcode,
 * wikilinks stripped) plus:
 *   - Obsidian image embeds `![[name.ext]]` → `![alt](/images/name.ext)`
 *   - Leading `# Title` heading stripped (already in front matter).
 *
 * Destination front matter is preserved verbatim — only the body is replaced.
 *
 * Usage:
 *   npm run republish                # interactive picker
 *   npm run republish -- character-sheet
 *
 * Vault dir: /mnt/d/Personal/Dropbox/Notebook/Writing/Tag And Tally/The Mind of Nox
 *   override with NOX_VAULT_DIR env var.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(__dirname, "..", "src", "www");
const VAULT_DIR =
  process.env.NOX_VAULT_DIR ??
  "/mnt/d/Personal/Dropbox/Notebook/Writing/Tag And Tally/The Mind of Nox";

const TARGETS = [
  {
    key: "character-sheet",
    label: "Character Sheet",
    sourceRel: "nox-knight/character-sheet.md",
    destAbs: path.join(SITE_DIR, "nox-knight", "index.md"),
  },
  {
    key: "history",
    label: "History",
    sourceRel: "nox-knight/history.md",
    destAbs: path.join(SITE_DIR, "nox-knight", "history.md"),
  },
  {
    key: "details",
    label: "Appearance & Personality",
    sourceRel: "nox-knight/notes.md",
    destAbs: path.join(SITE_DIR, "nox-knight", "details.md"),
  },
  {
    key: "home",
    label: "The Loft",
    sourceRel: "nox-knight/the-loft.md",
    destAbs: path.join(SITE_DIR, "nox-knight", "home.md"),
  },
  {
    key: "cloud",
    label: "The Drift Stack",
    sourceRel: "nox-knight/the-drift-stack.md",
    destAbs: path.join(SITE_DIR, "nox-knight", "cloud.md"),
  },
];

// ---------- front-matter splitter (verbatim preservation) ----------

/**
 * Splits `text` into `{ frontMatterRaw, body }` where `frontMatterRaw` is the
 * entire `---\n…\n---\n` block (including both fences and the trailing newline).
 * Returns `null` if the file has no front matter — we refuse to republish those.
 */
function splitFrontMatterVerbatim(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const afterClose = text.indexOf("\n", end + 1);
  const bodyStart = afterClose === -1 ? text.length : afterClose + 1;
  return {
    frontMatterRaw: text.slice(0, bodyStart),
    body: text.slice(bodyStart),
  };
}

// ---------- conversions (copied from publish-post.mjs + extended) ----------

function escapeQuotes(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Strip a leading `# Title` line (plus the blank line that follows, if any). */
function stripLeadingHeading(body) {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^#\s+\S/.test(lines[i])) {
    let j = i + 1;
    if (j < lines.length && lines[j].trim() === "") j++;
    return lines.slice(j).join("\n");
  }
  return body;
}

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
    while (j < lines.length) {
      const next = lines[j];
      if (next.trim() === "") {
        j++;
        break;
      }
      if (/^>\s*\[!/.test(next)) break;
      if (next.startsWith(">")) {
        innerLines.push(next.replace(/^>\s?/, ""));
      } else {
        innerLines.push(next.replace(/^\s+/, ""));
      }
      j++;
    }
    while (innerLines.length && !innerLines[0].trim()) innerLines.shift();
    while (innerLines.length && !innerLines[innerLines.length - 1].trim()) {
      innerLines.pop();
    }
    if (type === "ai") {
      const escTitle = escapeQuotes(title);
      const open = title
        ? `{% note "ai", "${escTitle}" %}`
        : `{% note "ai" %}`;
      out.push(open);
      out.push(...innerLines);
      out.push(`{% endnote %}`);
    } else {
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

function convertTallies(body) {
  // `+ on both ends absorbs the variable / asymmetric backtick padding the
  // vault uses around tally codes (1, 2, 5 backticks have all been seen).
  return body.replace(
    /`+\s*(boxes|circles|clocks)\s*:\s*(\d+)\s*\/\s*(\d+)\s*`+/g,
    (_m, type, current, total) => `{% tally "${type}", ${current}, ${total} %}`,
  );
}

/**
 * `![[name.ext]]` or `![[name.ext|alt]]` → `![alt](/images/name.ext)`.
 * Alt defaults to the filename stem with `_`/`-` → spaces.
 * MUST run before stripWikilinks so the wikilink regex doesn't swallow embeds.
 */
function convertImageEmbeds(body) {
  return body.replace(
    /!\[\[([^\]|]+\.(?:png|jpe?g|gif|webp|svg))(?:\|([^\]]+))?\]\]/gi,
    (_m, file, alt) => {
      const stem = file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      return `![${(alt ?? stem).trim()}](/images/${file})`;
    },
  );
}

function stripWikilinks(body) {
  return body.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_m, target, display) => (display ?? target).trim(),
  );
}

function convertBody(rawSource) {
  let out = stripLeadingHeading(rawSource);
  out = convertCallouts(out);
  out = convertTallies(out);
  out = convertImageEmbeds(out);
  out = stripWikilinks(out);
  return out;
}

// ---------- main flow ----------

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function validateSources() {
  if (!fs.existsSync(VAULT_DIR)) {
    console.error(`Vault directory does not exist:\n  ${VAULT_DIR}`);
    console.error("Set NOX_VAULT_DIR to override.");
    process.exit(1);
  }
  const missing = [];
  for (const t of TARGETS) {
    const src = path.join(VAULT_DIR, t.sourceRel);
    if (!fs.existsSync(src)) missing.push(`  ${t.key}: ${src}`);
  }
  if (missing.length) {
    console.error("Missing source file(s):");
    console.error(missing.join("\n"));
    process.exit(1);
  }
}

async function pickTarget() {
  const argKey = process.argv[2];
  if (argKey) {
    const t = TARGETS.find((x) => x.key === argKey);
    if (!t) {
      console.error(`Unknown target: ${argKey}`);
      console.error(`Available: ${TARGETS.map((x) => x.key).join(", ")}`);
      process.exit(1);
    }
    return t;
  }
  console.log(`\nRepublish target (vault: ${VAULT_DIR}):\n`);
  TARGETS.forEach((t, idx) => {
    console.log(`  ${idx + 1}. ${t.key.padEnd(18)} — ${t.label}`);
  });
  console.log("");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const pickRaw = (await ask(rl, "Pick a number to republish (or q): ")).trim();
  rl.close();
  if (!pickRaw || pickRaw.toLowerCase() === "q") {
    console.log("Aborted.");
    process.exit(0);
  }
  const pick = Number.parseInt(pickRaw, 10);
  if (!Number.isFinite(pick) || pick < 1 || pick > TARGETS.length) {
    console.error(`Invalid choice: ${pickRaw}`);
    process.exit(1);
  }
  return TARGETS[pick - 1];
}

function republish(target) {
  const sourcePath = path.join(VAULT_DIR, target.sourceRel);
  if (!fs.existsSync(target.destAbs)) {
    console.error(`Destination missing: ${target.destAbs}`);
    process.exit(1);
  }

  const sourceText = fs.readFileSync(sourcePath, "utf8");
  const destText = fs.readFileSync(target.destAbs, "utf8");
  const split = splitFrontMatterVerbatim(destText);
  if (!split) {
    console.error(
      `Destination has no front matter; refusing to overwrite:\n  ${target.destAbs}`,
    );
    process.exit(1);
  }

  const convertedBody = convertBody(sourceText);
  const out = split.frontMatterRaw + convertedBody;
  fs.writeFileSync(target.destAbs, out, "utf8");

  console.log(`Republished:`);
  console.log(`  source → ${sourcePath}`);
  console.log(`  dest   → ${target.destAbs}`);
}

async function main() {
  validateSources();
  const target = await pickTarget();
  republish(target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
