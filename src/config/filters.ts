import slugify from "slugify";

/** URL-safe slug. Also used by IdAttributePlugin / markdown-it-anchor. */
function slugifyTitle(str: string): string {
  return slugify(str, {
    lower: true,
    strict: true,
    replacement: "-",
  });
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function dayOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Calendar date as "April 8th, 2026". Accepts YYYY-MM-DD or a Date (UTC parts). */
function longDate(value: Date | string | undefined | null): string {
  if (value == null || value === "") {
    return "";
  }

  if (typeof value === "string") {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (iso) {
      const year = Number(iso[1]);
      const monthIndex = Number(iso[2]) - 1;
      const day = Number(iso[3]);
      if (monthIndex >= 0 && monthIndex < 12 && day >= 1 && day <= 31) {
        return `${MONTH_NAMES[monthIndex]} ${dayOrdinal(day)}, ${year}`;
      }
    }
  }

  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return `${MONTH_NAMES[d.getUTCMonth()]} ${dayOrdinal(d.getUTCDate())}, ${d.getUTCFullYear()}`;
}

/** Decode the HTML entities that survive tag-stripping (so excerpts read as text). */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Plain-text excerpt from markdown/HTML body for index lists. */
function plainExcerpt(
  content: string | undefined | null,
  maxLen: number = 220,
): string {
  if (content == null || content === "") {
    return "";
  }
  const stripped = decodeEntities(
    String(content)
      .replace(/<[^>]+>/g, " ")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*`\[\]_~>-]/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= maxLen) {
    return stripped;
  }
  return `${stripped.slice(0, maxLen - 1).trim()}…`;
}

/**
 * Excerpt for a collection item: the note's front-matter `excerpt` if set,
 * otherwise an auto-generated plain-text excerpt of its rendered content.
 */
function excerptOf(
  item: { data?: Record<string, unknown>; templateContent?: string },
  maxLen: number = 220,
): string {
  const ex = item?.data?.excerpt;
  if (typeof ex === "string" && ex.trim()) {
    return ex.trim();
  }
  return plainExcerpt(item?.templateContent, maxLen);
}

/** "chorari-ledger" → "Chorari Ledger". */
function humanize(value: string | undefined | null): string {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export default {
  slugify: slugifyTitle,
  longDate,
  plainExcerpt,
  excerptOf,
  humanize,
};
