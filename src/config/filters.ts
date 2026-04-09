import slugify from "slugify";

// A simple filter to ensure 3-digit padding
function padSuffix(num: number): string {
  return String(num).padStart(3, "0");
}

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

/** Calendar date as "April 8th, 2026". Accepts YYYY-MM-DD or a Date (uses UTC calendar parts). */
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

/**
 * Build-time coin flip (e.g. for Liquid). For Nunjucks `{% set x = randomBool() %}`
 * a `false` result can error; the home index uses `post.data.indexPolaroid` instead.
 */
function randomBool(): boolean {
  return Math.random() < 0.5;
}

const BOARD_TILT_PRESETS = [
  "transform: rotate(-3deg); margin-top: 0",
  "transform: rotate(2deg); margin-top: 20px",
  "transform: rotate(-2deg); margin-top: 40px",
  "transform: rotate(4deg); margin-top: 60px",
  "transform: rotate(-4deg); margin-top: 0",
  "transform: rotate(3deg); margin-top: 20px",
] as const;

/** Deterministic cork-board tilt from card index (0-based). */
function boardTiltStyle(index: number | string): string {
  const n = typeof index === "string" ? Number.parseInt(index, 10) : index;
  const i =
    Math.max(0, Math.floor(Number.isNaN(n) ? 0 : n)) %
    BOARD_TILT_PRESETS.length;
  return BOARD_TILT_PRESETS[i];
}

/** Plain-text excerpt from markdown/HTML body for note cards. */
function plainExcerpt(
  content: string | undefined | null,
  maxLen: number = 220,
): string {
  if (content == null || content === "") {
    return "";
  }
  const stripped = String(content)
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*`\[\]_~>-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= maxLen) {
    return stripped;
  }
  return `${stripped.slice(0, maxLen - 1).trim()}…`;
}

export default {
  padSuffix,
  slugify: slugifyTitle,
  longDate,
  randomBool,
  boardTiltStyle,
  plainExcerpt,
};
