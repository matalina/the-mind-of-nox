/**
 * Announce new notebook entries on Discord, Bluesky, Facebook and Instagram,
 * each with a link back to the entry's page:
 *
 *   Hey Ducklings! Check out the latest nightmare creature -- The Scuttling
 *   Oily Heap of Legs. Visit The Mind of Nox for more information and more
 *   ghoulish terrors.
 *
 * Every platform is optional and is skipped until its keys are in .env.
 * An entry is announced once, when its page is live and its date has come.
 * What has gone out is kept in .social-posted.json (git ignores it). If that
 * file is missing, every entry already live is recorded as done without
 * posting, so a new machine never floods the feeds with old entries.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pad } from "../../src/config/notebook-math.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.join(__dirname, "..", "..");
const NOTEBOOK_DIR = path.join(PROJECT_DIR, "src", "www", "notebook");
const RECORD = path.join(PROJECT_DIR, ".social-posted.json");
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
      const text = fs.readFileSync(path.join(NOTEBOOK_DIR, dir, file), "utf8");
      const parts = ["movement", "surface", "form", "features"].map((f) => field(text, f));
      if (!parts.every(Boolean)) continue;
      const date = field(text, "date") ?? "";
      if (date > todayLocal()) continue;
      const image = field(text, "image");
      out.push({
        key: `${dir}/${m[1]}`,
        date,
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

// ---------- the record ----------

const readRecord = () => (fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, "utf8")) : null);
const writeRecord = (r) => fs.writeFileSync(RECORD, JSON.stringify(r, null, 2) + "\n");

async function isLive(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Announce the entries not yet announced.
 *   waitMinutes: how long to wait for a new page to go live (after a push).
 *   dryRun: print what would be posted, change nothing.
 *   only: announce just this NN/PPP, even if it was announced before.
 *   markDone: record every live entry not yet in the record as announced,
 *     without posting (to stop old entries going out).
 */
export async function announce({ waitMinutes = 0, dryRun = false, only = null, markDone = false } = {}) {
  loadDotEnv();
  const ready = Object.keys(PLATFORMS).filter((p) => PLATFORMS[p].ready());
  if (!ready.length) return { skipped: "no social accounts are set up in .env" };

  const entries = readEntries();
  let record = readRecord();

  // First run on this machine (or markDone): everything already live counts
  // as announced, except an entry asked for by name.
  if (!record || markDone) {
    record ??= { entries: {} };
    let marked = 0;
    for (const e of entries) {
      if (e.key === only) continue;
      // markDone also gives up on old failed attempts, so they never retry.
      const done = record.entries[e.key];
      if (done && markDone) {
        for (const [p, v] of Object.entries(done)) if (String(v).startsWith("error")) done[p] = "skipped";
      }
      if (done) continue;
      if (await isLive(e.url)) {
        record.entries[e.key] = { seeded: new Date().toISOString() };
        marked++;
      }
    }
    if (!dryRun) writeRecord(record);
    console.log(`  … ${marked} live entries recorded as already announced, without posting`);
    if (markDone) return { posted: [], ready };
  }

  // New entries go to every platform; an entry tried before retries only the
  // platforms that failed.
  const todo = [];
  for (const e of entries) {
    if (only && e.key !== only) continue;
    const done = only ? undefined : record.entries[e.key];
    if (done?.seeded) continue;
    const platforms = done ? ready.filter((p) => String(done[p] ?? "").startsWith("error")) : ready;
    if (platforms.length) todo.push({ e, platforms });
  }
  if (!todo.length) return { posted: [], ready };

  const report = { posted: [], waiting: [], failed: [], ready };
  for (const { e, platforms } of todo) {
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
      console.log(`\n${e.key} → ${platforms.join(", ")}\n  ${message(e)}\n  ${e.url}`);
      report.posted.push(e.key);
      continue;
    }
    const result = { ...(record.entries[e.key] ?? {}) };
    for (const p of platforms) {
      try {
        result[p] = await PLATFORMS[p].post(e);
        console.log(`  ✓ ${e.key} on ${p}`);
      } catch (err) {
        result[p] = `error: ${err.message}`;
        report.failed.push(`${e.key} on ${p}: ${err.message}`);
      }
    }
    record.entries[e.key] = result;
    writeRecord(record);
    report.posted.push(e.key);
  }
  return report;
}
