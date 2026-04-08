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

export default {
  padSuffix,
  slugify: slugifyTitle,
  longDate,
};
