import slugify from "slugify";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typeSlug(type: string): string {
  const slug = slugify(type.trim(), {
    lower: true,
    strict: true,
    replacement: "-",
  });
  return slug || "note";
}

/**
 * Plain, themeable callout markup for the `sentence` (inline) and `note`
 * (paired) shortcodes — the rendered form of Obsidian callouts.
 *
 * Output is a semantic <aside> carrying `.callout` and `.callout--<type>`
 * classes plus a `data-callout` attribute, so the (currently blank) theme can
 * style each callout type via CSS without any markup changes.
 *
 * `bodyIsHtml=true` skips escaping when the caller pre-rendered markdown.
 */
export function calloutHtml(
  type: string,
  title: string,
  body: string,
  bodyIsHtml = false,
): string {
  const raw = (type ?? "").trim();
  const slug = typeSlug(raw);
  const label = raw || "note";
  const titleHtml = (title ?? "").trim()
    ? `<p class="callout__title">${escapeHtml(title.trim())}</p>`
    : "";
  const bodyHtml = bodyIsHtml ? (body ?? "") : escapeHtml(body ?? "");

  return `<aside class="callout callout--${slug}" data-callout="${escapeHtml(label)}"><span class="callout__type">${escapeHtml(label)}</span>${titleHtml}<div class="callout__body">${bodyHtml}</div></aside>`;
}
