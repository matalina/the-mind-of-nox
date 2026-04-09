/** Typical YouTube video id length and charset (alphanumeric, underscore, hyphen). */
const ID_RE = /^[\w-]{11}$/;

/**
 * Extract a YouTube video id from common URL shapes. Returns null if invalid.
 */
export function youtubeIdFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
    return ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.slice("/embed/".length).split("/")[0] ?? "";
      return ID_RE.test(id) ? id : null;
    }
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.slice("/shorts/".length).split("/")[0] ?? "";
      return ID_RE.test(id) ? id : null;
    }
    if (u.pathname === "/watch" || u.pathname === "/watch/") {
      const v = u.searchParams.get("v");
      if (v && ID_RE.test(v)) return v;
    }
  }

  return null;
}

/** Responsive embed markup for post body (shortcode output). */
export function youtubeEmbedHtml(url: string): string {
  const id = youtubeIdFromUrl(url);
  if (!id) return "";

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  return `<div class="youtube-embed"><iframe src="${src}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;
}
