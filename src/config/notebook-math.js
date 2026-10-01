/**
 * The notebook timeline. Each notebook is 104 pages, one night per page.
 * Notebook 01, page 001 is the morning after Nox's fourth birthday.
 */

export const PAGES_PER_NOTEBOOK = 104;
export const NOTEBOOK_COUNT = 60;

/**
 * The last notebook page on the blog: the morning of June 20th, 2026, the day
 * before his 21st birthday. Everything after that is told in the books.
 */
export const LAST_NIGHT = { notebook: 60, pageNo: 72 };

/** Pages the blog can use in a notebook (104, or fewer in the last one). */
export function pagesIn(notebook) {
  return notebook === LAST_NIGHT.notebook ? LAST_NIGHT.pageNo : PAGES_PER_NOTEBOOK;
}

const BORN = { year: 2005, month: 6, day: 21 };
const FIRST_NIGHT = Date.UTC(2009, 5, 22);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Handwriting by age: the youngest band first. */
const HANDS = [
  { maxAge: 7, hand: "child" },
  { maxAge: 12, hand: "kid" },
  { maxAge: 17, hand: "teen" },
  { maxAge: Infinity, hand: "adult" },
];

export const pad = (n, width) => String(n).padStart(width, "0");

/** Morning of the night on a given notebook and page, as a UTC timestamp. */
export function nightMs(notebook, pageNo) {
  return FIRST_NIGHT + ((notebook - 1) * PAGES_PER_NOTEBOOK + (pageNo - 1)) * DAY_MS;
}

export function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ageOn(ms) {
  const d = new Date(ms);
  const month = d.getUTCMonth() + 1;
  const hadBirthday =
    month > BORN.month || (month === BORN.month && d.getUTCDate() >= BORN.day);
  return d.getUTCFullYear() - BORN.year - (hadBirthday ? 0 : 1);
}

/** One hand per notebook: his age on the notebook's first page. */
export function handFor(notebook) {
  const age = ageOn(nightMs(notebook, 1));
  return HANDS.find((h) => age <= h.maxAge).hand;
}

/** Where the notebook is kept: books 01–30 and 31–59 in storage, 60 in his bag. */
export function placeFor(notebook) {
  if (notebook === NOTEBOOK_COUNT) return "bag";
  return notebook <= 30 ? "box-1" : "box-2";
}
