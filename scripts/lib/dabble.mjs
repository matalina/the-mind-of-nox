/**
 * Push every notebook entry's creature to the Creature Ledger in Dabble
 * (Breaking the Cycle), one line per night on its "Notebook NN" page:
 *
 *   10/014 | 2012-01-27 | The Flickering Chitinous Stalk of Tentacles (...)
 *
 * Lines are matched by their NN/PPP key, so syncing twice changes nothing,
 * a changed creature replaces its line, and lines added by hand in Dabble are
 * kept. A page is only written when its text actually changes.
 *
 * Needs DABBLE_API_KEY (an API key from Dabble's Connected Apps page, with
 * planning:write). Set it in the environment or in a .env file at the project
 * root, which git ignores.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { pad, nightMs, isoDate, pagesIn } from "../../src/config/notebook-math.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..", "..");
const NOTEBOOK_DIR = path.join(PROJECT_DIR, "src", "www", "notebook");

const API = "https://connect.dabblewriter.com/v1";
/** Breaking the Cycle, and its Creature Ledger page. */
const DEFAULT_PROJECT = "qmMpumOl2gYnt5KW";
const DEFAULT_LEDGER = "Pf3I";

/** KEY=value lines from .env, without overriding the real environment. */
function loadDotEnv() {
  const file = path.join(PROJECT_DIR, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

// ---------- the entries ----------

const field = (text, f) =>
  new RegExp(`^\\s+${f}:\\s*"?([^"\\n]+)"?\\s*$`, "m").exec(text)?.[1].trim();

const t = (v) => `[${v}]`;

/** The ledger line for one entry, in the Creature Ledger's entry format. */
export function ledgerLine(notebook, pageNo, c) {
  const key = `${pad(notebook, 2)}/${pad(pageNo, 3)}`;
  const date = isoDate(nightMs(notebook, pageNo));
  return `${key} | ${date} | The ${c.movement} ${c.surface} ${c.form} of ${c.features} (${t(c.disposition)} ${t("Monstrosity")}): This creature ${t(c.motivation)} and attacks with ${t(c.attack)} for ${t(c.damage)} damage. It features a unique ability to ${t(c.special)}. It ${t(c.strength)} and ${t(c.weakness)}.`;
}

/** Every written entry, as { notebook, pageNo, line }. */
export function readEntries() {
  const entries = [];
  if (!fs.existsSync(NOTEBOOK_DIR)) return entries;
  for (const dir of fs.readdirSync(NOTEBOOK_DIR).sort()) {
    if (!/^\d{2}$/.test(dir)) continue;
    for (const file of fs.readdirSync(path.join(NOTEBOOK_DIR, dir)).sort()) {
      const m = /^(\d{3})\.md$/.exec(file);
      if (!m) continue;
      const text = fs.readFileSync(path.join(NOTEBOOK_DIR, dir, file), "utf8");
      const names = ["movement", "surface", "form", "features", "disposition", "motivation",
        "attack", "damage", "special", "strength", "weakness"];
      const c = Object.fromEntries(names.map((n) => [n, field(text, n)]));
      const missing = names.filter((n) => !c[n]);
      if (missing.length) {
        console.warn(`  ! ${dir}/${m[1]} is missing ${missing.join(", ")}; skipped.`);
        continue;
      }
      const notebook = Number(dir);
      const pageNo = Number(m[1]);
      entries.push({ notebook, pageNo, line: ledgerLine(notebook, pageNo, c) });
    }
  }
  return entries;
}

// ---------- the API ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(key) {
  return async function call(method, url, body) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const headers = { Authorization: `Bearer ${key}` };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        // Safe to retry: a repeat of the same write replays the first answer.
        headers["Idempotency-Key"] = createHash("sha256")
          .update(`${method} ${url} ${JSON.stringify(body)}`)
          .digest("hex");
      }
      const res = await fetch(`${API}${url}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 429) {
        const wait = Number(res.headers.get("Retry-After") ?? 30);
        console.log(`  … Dabble rate limit, waiting ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(`Dabble ${method} ${url} answered ${res.status} ${data.error ?? ""}: ${data.message ?? ""}`);
      }
      return data;
    }
    throw new Error(`Dabble ${method} ${url} kept hitting the rate limit.`);
  };
}

/** The ledger's child pages, by title, from either a nested or a flat tree. */
function ledgerChildren(tree, ledgerId) {
  const items = tree.items ?? tree.notebook ?? tree.pages ?? tree;
  if (!Array.isArray(items)) throw new Error("Unexpected notebook tree from Dabble.");
  const found = new Map();
  // Nested: { id, title, children: [...] }.
  const walk = (list) => {
    for (const item of list) {
      if (item.id === ledgerId) {
        for (const child of item.children ?? []) found.set(child.title, child.id);
        return true;
      }
      if (item.children && walk(item.children)) return true;
    }
    return false;
  };
  if (walk(items) && found.size) return found;
  // Flat: { id, title, depth } in tree order.
  const at = items.findIndex((i) => i.id === ledgerId);
  if (at >= 0 && "depth" in items[at]) {
    for (const item of items.slice(at + 1)) {
      if (item.depth <= items[at].depth) break;
      if (item.depth === items[at].depth + 1) found.set(item.title, item.id);
    }
  }
  return found;
}

/**
 * The notebook tree. Some keys are refused the notebook listing itself, so
 * fall back to the project outline, which carries the notebook too.
 */
async function notebookTree(call, project) {
  try {
    return await call("GET", `/projects/${project}/notebook`);
  } catch (err) {
    if (!/answered 403/.test(err.message)) throw err;
    console.log("  … notebook listing refused, using the project outline instead");
    const outline = await call("GET", `/projects/${project}/outline`);
    return { notebook: outline.notebook ?? [] };
  }
}

async function readPage(call, project, pageId) {
  let text = "";
  let offset = 0;
  for (;;) {
    const page = await call(
      "GET",
      `/projects/${project}/notebook/pages/${pageId}?format=text&offset=${offset}`,
    );
    text += page.text ?? "";
    if (page.nextOffset == null) return text;
    offset = page.nextOffset;
  }
}

const KEY = /^(\d{2})\/(\d{3}) \|/;

/**
 * The page's new text: its own lines (the header and anything written by
 * hand) with each entry's line put in, in page order.
 */
function merge(current, wanted) {
  const lines = current.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines.filter((l) => !KEY.test(l));
  const byKey = new Map(lines.filter((l) => KEY.test(l)).map((l) => [l.slice(0, 6), l]));
  for (const line of wanted) byKey.set(line.slice(0, 6), line);
  const entries = [...byKey.keys()].sort().map((k) => byKey.get(k));
  return [...header, ...entries].join("\n\n");
}

/**
 * What the key can see: its account, app and scopes, and the project with the
 * role the account holds on it. For working out a 403.
 */
export async function checkAccess() {
  loadDotEnv();
  const key = process.env.DABBLE_API_KEY;
  if (!key) return { skipped: "DABBLE_API_KEY is not set" };
  const project = process.env.DABBLE_PROJECT_ID || DEFAULT_PROJECT;
  const call = client(key);
  const me = await call("GET", "/me");
  const { projects = [] } = await call("GET", "/projects?limit=200");
  return { me, project, found: projects.find((p) => p.id === project) ?? null, count: projects.length };
}

/**
 * Sync the ledger. Returns a short report. With dryRun, reads Dabble and
 * reports what would change without writing.
 */
export async function syncLedger({ dryRun = false } = {}) {
  loadDotEnv();
  const key = process.env.DABBLE_API_KEY;
  if (!key) return { skipped: "DABBLE_API_KEY is not set" };
  const project = process.env.DABBLE_PROJECT_ID || DEFAULT_PROJECT;
  const ledger = process.env.DABBLE_LEDGER_PAGE_ID || DEFAULT_LEDGER;
  const call = client(key);

  const byNotebook = new Map();
  for (const e of readEntries()) {
    if (e.pageNo > pagesIn(e.notebook)) continue;
    if (!byNotebook.has(e.notebook)) byNotebook.set(e.notebook, []);
    byNotebook.get(e.notebook).push(e.line);
  }

  const pages = ledgerChildren(await notebookTree(call, project), ledger);
  const report = { updated: [], unchanged: [], missing: [] };

  for (const [notebook, lines] of [...byNotebook].sort((a, b) => a[0] - b[0])) {
    const title = `Notebook ${pad(notebook, 2)}`;
    const pageId = pages.get(title);
    if (!pageId) {
      report.missing.push(title);
      continue;
    }
    const current = await readPage(call, project, pageId);
    const next = merge(current, lines);
    if (next === merge(current, [])) {
      report.unchanged.push(title);
      continue;
    }
    if (!dryRun) {
      await call("PATCH", `/projects/${project}/notebook/pages/${pageId}`, { text: next });
    }
    report.updated.push(title);
  }
  return report;
}
