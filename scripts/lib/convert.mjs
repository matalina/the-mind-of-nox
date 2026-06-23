/**
 * Shared Obsidian → Eleventy conversion helpers.
 *
 * Extracted from the old publish-post.mjs / republish-page.mjs scripts so the
 * vault sync has a single source of truth for the "vault functions":
 *   - front-matter split/parse/rebuild (limited YAML dialect)
 *   - Obsidian callouts (`> [!type] Title`) → `{% sentence %}` / `{% note %}` (ai)
 *   - tally code-spans (`` `boxes:N/M` ``) → `{% tally %}`
 *   - image embeds (`![[img.ext]]`) → markdown image
 *   - wikilink stripping (`[[target|display]]` → text)
 *   - leading `# Heading` strip + first-heading extraction (title fallback)
 *
 * Pure Node + regex/string work — no platform assumptions, Windows-safe.
 */

// ---------- front matter ----------

/** Splits a file into `{ frontMatterRaw, body, hasFrontMatter }`. */
export function splitFrontMatter(text) {
  if (!text.startsWith("---")) {
    return { frontMatterRaw: "", body: text, hasFrontMatter: false };
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return { frontMatterRaw: "", body: text, hasFrontMatter: false };
  }
  const afterClose = text.indexOf("\n", end + 1);
  const bodyStart = afterClose === -1 ? text.length : afterClose + 1;
  const frontMatterRaw = text.slice(4, end); // between leading `---\n` and `\n---`
  const body = text.slice(bodyStart);
  return { frontMatterRaw, body, hasFrontMatter: true };
}

/**
 * Parses the limited YAML shapes our vault files use:
 *   key: scalar
 *   tags: [a, b]
 *   tags:
 *     - a
 *     - b
 *   key: true|false|number
 * Returns a Map (preserves insertion order) of key → value.
 */
export function parseFrontMatter(raw) {
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
      // block list (or an empty/placeholder key like `published:`)
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
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

/** Quote a scalar for our generated YAML (always-safe double-quoted form). */
export function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// ---------- body conversions ----------

export function escapeQuotes(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** First `# Heading` text in the body, or null. Used as a title fallback. */
export function firstHeading(body) {
  const lines = body.split("\n");
  for (const line of lines) {
    if (line.trim() === "") continue;
    const m = line.match(/^#\s+(\S.*)$/);
    return m ? m[1].trim() : null;
  }
  return null;
}

function normHeading(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Strip a leading heading line only when it duplicates the page `title` (so a
 * `# Creatures` title is removed, but a note that opens straight into a
 * `# Appearance` *section* keeps that header). Without a title, nothing is
 * stripped.
 */
export function stripLeadingHeading(body, title) {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  const m = i < lines.length ? lines[i].match(/^#{1,6}\s+(\S.*?)\s*$/) : null;
  if (m && title != null && normHeading(m[1]) === normHeading(title)) {
    let j = i + 1;
    if (j < lines.length && lines[j].trim() === "") j++;
    return lines.slice(j).join("\n");
  }
  return body;
}

/**
 * Convert Obsidian callouts (`> [!type] Title` + continuation lines starting
 * with `>`) into shortcodes. `ai` callouts become a paired `{% note %}` (body
 * markdown preserved); all others become an inline `{% sentence %}` with the
 * body collapsed to a single string.
 */
export function convertCallouts(body) {
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
    // Absorb body lines until a blank line or a sibling callout marker. Lines
    // starting with `>` are stripped; non-`>` lines are taken as lazy
    // continuation (matches common Obsidian authoring slips).
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
    // Surround the generated shortcode with blank lines. The shortcodes render
    // to <aside> HTML blocks; without a trailing blank line markdown-it folds the
    // following lines into that HTML block and stops parsing them as markdown.
    if (out.length && out[out.length - 1].trim() !== "") out.push("");
    if (type === "ai") {
      const escTitle = escapeQuotes(title);
      const open = title ? `{% note "ai", "${escTitle}" %}` : `{% note "ai" %}`;
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
    out.push("");
    i = j;
  }
  return out.join("\n");
}

/**
 * Convert `` `boxes:N/M` `` (and `circles`, `clocks`) to `{% tally %}`.
 * Tolerates the variable / asymmetric backtick padding the vault uses.
 */
export function convertTallies(body) {
  return body.replace(
    /`+\s*(boxes|circles|clocks)\s*:\s*(\d+)\s*\/\s*(\d+)\s*`+/g,
    (_m, type, current, total) => `{% tally "${type}", ${current}, ${total} %}`,
  );
}

/**
 * `![[name.ext]]` or `![[name.ext|alt]]` → `![alt](<imageBase>name.ext)`.
 * Alt defaults to the filename stem with `_`/`-` → spaces. The returned object
 * also reports which image filenames were referenced so the caller can copy
 * them out of the vault. MUST run before stripWikilinks.
 */
export function convertImageEmbeds(body, imageBase = "/images/") {
  const referenced = [];
  const converted = body.replace(
    /!\[\[([^\]|]+\.(?:png|jpe?g|gif|webp|svg))(?:\|([^\]]+))?\]\]/gi,
    (_m, file, alt) => {
      referenced.push(file);
      const stem = file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      return `![${(alt ?? stem).trim()}](${imageBase}${file})`;
    },
  );
  return { body: converted, referenced };
}

/**
 * Convert `--` (the vault's em-dash convention) to a real em-dash (—).
 * Leaves fenced code blocks and inline code spans untouched, and ignores runs
 * of 3+ hyphens so markdown `---` rules / table borders survive.
 */
export function convertDashes(body) {
  let inFence = false;
  return body
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // Split into inline-code spans (kept as-is) and plain text (converted).
      return line.replace(/(`+[^`]*`+)|([^`]+)/g, (_m, code, text) =>
        code ? code : text.replace(/(?<!-)--(?!-)/g, "—"),
      );
    })
    .join("\n");
}

/** Readable label for a bare wikilink with no `|display`: last heading or note leaf. */
function wikilinkLabel(target) {
  const parts = target
    .split("#")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1] ?? target;
  return last.split(/[\\/]/).filter(Boolean).pop() ?? last;
}

/** Strip Obsidian wikilinks: `[[target|display]]` → `display`, `[[target]]` → leaf text. */
export function stripWikilinks(body) {
  return body.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_m, target, display) =>
      display != null ? display.trim() : wikilinkLabel(target.trim()),
  );
}

/**
 * Convert Obsidian wikilinks to markdown links. `resolveLink(target)` receives
 * the raw target (path + optional `#heading`, before any `|display`) and returns
 * a site URL, or null/empty when it can't resolve — in which case we emit plain
 * display text (no broken link).
 */
export function convertWikilinks(body, resolveLink) {
  return body.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
    (_m, target, display) => {
      const t = target.trim();
      const label = (display != null ? display : wikilinkLabel(t)).trim();
      const url = resolveLink(t);
      return url ? `[${label}](${url})` : label;
    },
  );
}

// ---------- zoom-map blocks ----------

/** Parse a ```zoommap` block's `key: value` config (ignoring `#` comments). */
function parseZoomConfig(inner) {
  const cfg = {};
  for (const raw of inner.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    cfg[m[1].toLowerCase()] = m[2].replace(/\s+#.*$/, "").trim();
  }
  return cfg;
}

function numOrNull(v) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert ```zoommap` code blocks (the zoom-map Obsidian plugin) into a
 * `<div class="zoommap">` carrying its config + resolved markers as JSON, for
 * the client-side Leaflet renderer ([src/assets/js/zoommap.js]).
 *
 * `loadMarkers(imageRef, markersRef)` is supplied by the caller (it reads the
 * sidecar `<image>.markers.json` from the vault — the lib stays fs-free).
 * Marker `link`s are resolved to site URLs via `resolveLink`. Returns the
 * converted body plus the base-image filenames referenced (for copy-out).
 *
 * Runs last in the pipeline so no earlier text pass touches the emitted JSON.
 */
export function convertZoomMaps(body, { imageBase = "/images/", resolveLink, loadMarkers }) {
  const referenced = [];
  const converted = body.replace(
    /```+[ \t]*zoommap[^\n]*\n([\s\S]*?)\n```+/g,
    (whole, inner) => {
      const cfg = parseZoomConfig(inner);
      if (!cfg.image) return whole;
      const filename = cfg.image.split(/[\\/]/).pop();
      referenced.push(filename);

      const doc = (loadMarkers && loadMarkers(cfg.image, cfg.markers)) || {};
      const size = doc.size || {};
      const markers = (doc.markers || [])
        .filter((m) => m && typeof m.x === "number" && typeof m.y === "number")
        .map((m) => ({
          x: m.x,
          y: m.y,
          label: m.link || "",
          url: (m.link && resolveLink && resolveLink(m.link)) || null,
          tooltip: m.tooltip || "",
        }));
      const lines = (doc.drawings || [])
        .filter((d) => d && d.kind === "polyline" && Array.isArray(d.polyline))
        .map((d) => ({
          points: d.polyline.map((p) => ({ x: p.x, y: p.y })),
          color: (d.style && d.style.strokeColor) || "#ff0000",
          width: (d.style && d.style.strokeWidth) || 2,
        }));

      const data = {
        image: `${imageBase}${filename}`,
        w: typeof size.w === "number" ? size.w : null,
        h: typeof size.h === "number" ? size.h : null,
        minZoom: numOrNull(cfg.minzoom),
        maxZoom: numOrNull(cfg.maxzoom),
        height: cfg.height || "560px",
        markers,
        lines,
      };
      const height = String(data.height).replace(/[^\w%.\-]/g, "") || "560px";
      // Escape `<` so the JSON can't break out of the <script> / confuse markdown.
      const json = JSON.stringify(data).replace(/</g, "\\u003c");
      return `<div class="zoommap" style="height:${height}"><script type="application/json">${json}</script></div>`;
    },
  );
  return { body: converted, referenced };
}

/**
 * Remove ```table-of-contents` blocks (the automatic-table-of-contents plugin).
 * The TOC is rendered from the page's headings in the layout sidebar instead, so
 * here we just strip the block and report the requested heading levels.
 * Returns `{ body, toc }` where `toc` is `{ minLevel, maxLevel }` or null.
 */
export function extractTableOfContents(body) {
  let toc = null;
  const stripped = body.replace(
    /```+[ \t]*table-of-contents[^\n]*\n([\s\S]*?)\n```+/g,
    (_m, inner) => {
      const cfg = parseZoomConfig(inner); // shared key: value parser
      const min = Number.parseInt(cfg.minlevel, 10);
      const max = Number.parseInt(cfg.maxlevel, 10);
      toc = {
        minLevel: Number.isFinite(min) ? min : 2,
        maxLevel: Number.isFinite(max) ? max : 3,
      };
      return "";
    },
  );
  return { body: stripped, toc };
}

/**
 * Full body conversion pipeline used by the sync. Returns the converted body,
 * the list of referenced image filenames (for copy-out), and any table-of-
 * contents request (`{ minLevel, maxLevel }` or null).
 *
 * Options: `imageBase` (embed URL prefix), `resolveLink` (wikilink resolver;
 * when omitted, wikilinks are stripped to plain text), and `loadMarkers`
 * (zoom-map sidecar loader; when omitted, ```zoommap` blocks are left as-is).
 */
export function convertBody(rawBody, { imageBase = "/images/", resolveLink, loadMarkers, title } = {}) {
  let out = stripLeadingHeading(rawBody, title);
  const tocInfo = extractTableOfContents(out);
  out = tocInfo.body;
  out = convertCallouts(out);
  out = convertTallies(out);
  const embeds = convertImageEmbeds(out, imageBase);
  out = embeds.body;
  out = resolveLink ? convertWikilinks(out, resolveLink) : stripWikilinks(out);
  out = convertDashes(out);

  const referenced = [...embeds.referenced];
  if (loadMarkers) {
    const maps = convertZoomMaps(out, { imageBase, resolveLink, loadMarkers });
    out = maps.body;
    referenced.push(...maps.referenced);
  }
  return { body: out, referenced, toc: tocInfo.toc };
}
