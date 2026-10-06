/**
 * Announce new notebook entries on Discord, Bluesky, Facebook and Instagram,
 * each with a link back to the entry's page:
 *
 *   Hey Ducklings! Check out the latest nightmare creature -- The Scuttling
 *   Oily Heap of Legs. Visit The Mind of Nox for more information and more
 *   ghoulish terrors.
 *
 * Every platform is optional and is skipped until its keys are in .env.
 * An entry is announced once its date has come. What has gone out is marked
 * in the entry itself: npm run publish stamps `published: YYYY-MM-DD` into the
 * frontmatter of every entry without one, commits that, and announces those
 * entries. An entry with the flag is never picked up again on its own.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pad } from "../../src/config/notebook-math.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..", "..");
const NOTEBOOK_DIR = path.join(PROJECT_DIR, "src", "www", "notebook");
const GRAPH = "https://graph.facebook.com/v21.0";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadDotEnv() {
  const file = path.join(PROJECT_DIR, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const siteUrl = () => (process.env.NOX_SITE_URL || "https://themindofnox.com").replace(/\/$/, "");

// ---------- the entries ----------

const field = (text, f) =>
  new RegExp(`^\\s*${f}:\\s*"?([^"\\n]+)"?\\s*$`, "m").exec(text)?.[1].trim();

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
}

/** Entries whose posting date has come, oldest posting date first. */
export function readEntries() {
  const out = [];
  for (const dir of fs.existsSync(NOTEBOOK_DIR) ? fs.readdirSync(NOTEBOOK_DIR).sort() : []) {
    if (!/^\d{2}$/.test(dir)) continue;
    for (const file of fs.readdirSync(path.join(NOTEBOOK_DIR, dir)).sort()) {
      const m = /^(\d{3})\.md$/.exec(file);
      if (!m) continue;
      const source = path.join(NOTEBOOK_DIR, dir, file);
      const text = fs.readFileSync(source, "utf8");
      const parts = ["movement", "surface", "form", "features"].map((f) => field(text, f));
      if (!parts.every(Boolean)) continue;
      const date = field(text, "date") ?? "";
      if (date > todayLocal()) continue;
      const image = field(text, "image");
      out.push({
        key: `${dir}/${m[1]}`,
        source,
        date,
        published: field(text, "published") ?? null,
        name: `The ${parts[0]} ${parts[1]} ${parts[2]} of ${parts[3]}`,
        url: `${siteUrl()}/notebook/${dir}/${m[1]}/`,
        imageUrl: image ? `${siteUrl()}${image}` : null,
        imageFile: image ? path.join(PROJECT_DIR, "src", "assets", image.replace(/^\//, "")) : null,
        imageAlt: field(text, "imageAlt") ?? "",
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

/** Entries whose date has come but that have no `published:` flag yet. */
export const unpublished = () => readEntries().filter((e) => !e.published);

/**
 * Stamp `published: <today>` into each entry's frontmatter, just after its
 * `date:` line (or at the end of the frontmatter). Entries already flagged are
 * left alone.
 */
export function markPublished(entries) {
  const today = todayLocal();
  for (const e of entries) {
    const text = fs.readFileSync(e.source, "utf8");
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!fm || /^published:/m.test(fm[1])) continue;
    const nl = text.includes("\r\n") ? "\r\n" : "\n";
    const line = `published: ${today}`;
    const body = /^date:.*$/m.test(fm[1])
      ? fm[1].replace(/^date:.*$/m, (d) => `${d}${nl}${line}`)
      : `${fm[1]}${nl}${line}`;
    fs.writeFileSync(e.source, text.slice(0, fm.index) + `---${nl}${body}${nl}---` + text.slice(fm.index + fm[0].length));
    e.published = today;
  }
  return entries;
}

/**
 * Hashtags, only where they do something: Instagram and Bluesky. Letters,
 * numbers and underscores only; anything else (like &) ends the tag.
 */
export const HASHTAGS = {
  instagram: ["tagNtally", "noxknight", "nightmare", "horror", "creature", "nightmarejournal"],
  bluesky: ["tagNtally", "noxknight", "horror", "nightmare"],
};

export const message = (e) =>
  `Hey Ducklings! Check out the latest nightmare creature -- ${e.name}. Visit The Mind of Nox for more information and more ghoulish terrors.`;

// ---------- the platforms ----------

/** A smaller JPEG of a drawing, or null if sharp is not installed. */
async function shrink(bytes) {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(bytes).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

async function json(res, what) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${what} answered ${res.status}: ${JSON.stringify(data.error ?? data).slice(0, 300)}`);
  return data;
}

const PLATFORMS = {
  discord: {
    ready: () => Boolean(process.env.DISCORD_WEBHOOK_URL),
    async post(e) {
      // Discord builds the preview card (drawing, title) from the page itself.
      const res = await fetch(`${process.env.DISCORD_WEBHOOK_URL}?wait=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `${message(e)}\n${e.url}` }),
      });
      return (await json(res, "Discord")).id;
    },
  },

  bluesky: {
    ready: () => Boolean(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD),
    async post(e) {
      const host = process.env.BLUESKY_SERVICE || "https://bsky.social";
      const session = await json(
        await fetch(`${host}/xrpc/com.atproto.server.createSession`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: process.env.BLUESKY_HANDLE,
            password: process.env.BLUESKY_APP_PASSWORD,
          }),
        }),
        "Bluesky login",
      );
      const auth = { Authorization: `Bearer ${session.accessJwt}` };

      // The link card's picture. Bluesky takes up to about 1 MB, so a bigger
      // drawing is sent as a smaller copy.
      let thumb;
      if (e.imageFile && fs.existsSync(e.imageFile)) {
        let bytes = fs.readFileSync(e.imageFile);
        if (bytes.length > 950_000) bytes = await shrink(bytes);
        if (bytes && bytes.length <= 950_000) {
          const up = await json(
            await fetch(`${host}/xrpc/com.atproto.repo.uploadBlob`, {
              method: "POST",
              headers: { ...auth, "Content-Type": "image/jpeg" },
              body: bytes,
            }),
            "Bluesky image upload",
          );
          thumb = up.blob;
        } else {
          console.log(`  … ${e.key}: could not get the drawing under Bluesky's 1 MB limit, posting the link card without it`);
        }
      }

      // Your message and the link, then as many hashtags as fit in Bluesky's
      // 300 characters.
      let text = `${message(e)}\n${e.url}`;
      const length = (s) => [...new Intl.Segmenter().segment(s)].length;
      const tags = [];
      for (const tag of HASHTAGS.bluesky) {
        const next = `${text}${tags.length ? " " : "\n"}#${tag}`;
        if (length(next) > 300) break;
        text = next;
        tags.push(tag);
      }
      const bytesTo = (s) => Buffer.byteLength(s);
      const start = bytesTo(text.slice(0, text.indexOf(e.url)));
      // Make the address a real link, and each hashtag a real tag.
      const facets = [
        {
          index: { byteStart: start, byteEnd: start + bytesTo(e.url) },
          features: [{ $type: "app.bsky.richtext.facet#link", uri: e.url }],
        },
        ...tags.map((tag) => {
          const at = bytesTo(text.slice(0, text.lastIndexOf(`#${tag}`)));
          return {
            index: { byteStart: at, byteEnd: at + bytesTo(`#${tag}`) },
            features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
          };
        }),
      ];
      const record = {
        $type: "app.bsky.feed.post",
        text,
        createdAt: new Date().toISOString(),
        langs: ["en"],
        facets,
        embed: {
          $type: "app.bsky.embed.external",
          external: { uri: e.url, title: e.name, description: "A nightmare from Nox's journal.", ...(thumb && { thumb }) },
        },
      };
      const res = await fetch(`${host}/xrpc/com.atproto.repo.createRecord`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record }),
      });
      return (await json(res, "Bluesky post")).uri;
    },
  },

  facebook: {
    ready: () => Boolean(process.env.FACEBOOK_PAGE_ID && process.env.META_PAGE_TOKEN),
    async post(e) {
      // A link post: Facebook builds the preview card from the page.
      const body = new URLSearchParams({ message: message(e), link: e.url, access_token: process.env.META_PAGE_TOKEN });
      const res = await fetch(`${GRAPH}/${process.env.FACEBOOK_PAGE_ID}/feed`, { method: "POST", body });
      return (await json(res, "Facebook")).id;
    },
  },

  instagram: {
    ready: () => Boolean(process.env.INSTAGRAM_ACCOUNT_ID && process.env.META_PAGE_TOKEN),
    async post(e) {
      // Instagram needs a picture, and links in captions are not clickable.
      if (!e.imageUrl) return "skipped: no drawing";
      const id = process.env.INSTAGRAM_ACCOUNT_ID;
      const token = process.env.META_PAGE_TOKEN;
      const caption = `${message(e)} Link in bio.\n\n${HASHTAGS.instagram.map((t) => `#${t}`).join(" ")}`;
      const media = await json(
        await fetch(`${GRAPH}/${id}/media`, {
          method: "POST",
          body: new URLSearchParams({ image_url: e.imageUrl, caption, access_token: token }),
        }),
        "Instagram upload",
      );
      // Instagram fetches the picture in the background; publish once it is ready.
      for (let i = 0; i < 12; i++) {
        const status = await json(
          await fetch(`${GRAPH}/${media.id}?fields=status_code&access_token=${encodeURIComponent(token)}`),
          "Instagram status",
        );
        if (status.status_code === "FINISHED") break;
        if (status.status_code === "ERROR") throw new Error("Instagram could not fetch the drawing.");
        await sleep(5000);
      }
      const done = await json(
        await fetch(`${GRAPH}/${id}/media_publish`, {
          method: "POST",
          body: new URLSearchParams({ creation_id: media.id, access_token: token }),
        }),
        "Instagram publish",
      );
      return done.id;
    },
  },
};

// ---------- announcing ----------

async function isLive(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Announce entries.
 *   entries: the entries to announce. npm run publish passes the ones it just
 *     flagged. Left out, it is every entry without a `published:` flag, and
 *     those are flagged here (unless dryRun).
 *   waitMinutes: how long to wait for a new page to go live (after a push).
 *   dryRun: print what would be posted, change nothing.
 *   only: announce just this NN/PPP, flagged or not (to retry or repost one).
 *   platform: use only this platform (e.g. "facebook"), for testing one.
 *   markDone: flag every unflagged entry as published, without posting (to
 *     stop old entries going out).
 */
export async function announce({ entries = null, waitMinutes = 0, dryRun = false, only = null, markDone = false, platform = null } = {}) {
  loadDotEnv();

  if (markDone) {
    const flagged = dryRun ? unpublished() : markPublished(unpublished());
    console.log(`  … ${flagged.length} entries flagged as published, without posting: ${flagged.map((e) => e.key).join(", ") || "none"}`);
    return { posted: [], ready: [] };
  }

  const ready = Object.keys(PLATFORMS).filter((p) => PLATFORMS[p].ready() && (!platform || p === platform));
  if (!ready.length) return { skipped: "no social accounts are set up in .env" };

  if (only) {
    entries = readEntries().filter((e) => e.key === only);
    if (!entries.length) throw new Error(`No entry ${only} with a date that has come.`);
  } else if (!entries) {
    entries = unpublished();
    if (!dryRun) markPublished(entries);
  }
  if (!entries.length) return { posted: [], ready };

  const report = { posted: [], waiting: [], failed: [], ready };
  for (const e of entries) {
    let live = await isLive(e.url);
    for (let waited = 0; !live && waited < waitMinutes * 60; waited += 20) {
      if (waited === 0) console.log(`  … waiting for ${e.url} to go live`);
      await sleep(20_000);
      live = await isLive(e.url);
    }
    if (!live) {
      report.waiting.push(e.key);
      continue;
    }
    if (dryRun) {
      console.log(`\n${e.key} → ${ready.join(", ")}\n  ${message(e)}\n  ${e.url}`);
      report.posted.push(e.key);
      continue;
    }
    for (const p of ready) {
      try {
        await PLATFORMS[p].post(e);
        console.log(`  ✓ ${e.key} on ${p}`);
      } catch (err) {
        console.log(`  ✗ ${e.key} on ${p}: ${err.message}`);
        report.failed.push(`${e.key} on ${p}: ${err.message} (retry: npm run social -- ${e.key} --${p})`);
      }
    }
    report.posted.push(e.key);
  }
  return report;
}
