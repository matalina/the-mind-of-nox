/**
 * The site's public address, for absolute links (link-preview tags, the
 * feed, social posts). Set NOX_SITE_URL in .env, or in Netlify's environment
 * variables for its builds; Netlify's own URL is the fallback there.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
const fromDotEnv = fs.existsSync(envFile)
  ? /^\s*NOX_SITE_URL\s*=\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(fs.readFileSync(envFile, "utf8"))?.[1]
  : undefined;

const url = (process.env.NOX_SITE_URL ?? fromDotEnv ?? process.env.URL ?? "https://themindofnox.com").replace(/\/$/, "");

export default {
  url,
  name: "The Mind of Nox",
  description:
    "Nox Knight's nightmare journal: a new creature every weekday, drawn the morning he woke at 3:53.",
};
