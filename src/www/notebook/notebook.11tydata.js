/**
 * Every file in src/www/notebook/NN/PPP.md is one night: notebook NN, page PPP.
 * The night's date, Nox's age and the handwriting all come from the notebook
 * and page number, so an entry only needs its creature, its text and the
 * `date:` it was posted.
 */

import {
  pad,
  nightMs,
  isoDate,
  ageOn,
  handFor,
} from "../../config/notebook-math.js";

function position(filePathStem) {
  const m = /\/notebook\/(\d+)\/(\d+)$/.exec(filePathStem ?? "");
  if (!m) return null;
  return { notebook: Number(m[1]), pageNo: Number(m[2]) };
}

const at = (data) => position(data.page.filePathStem);

export default {
  layout: "entry.njk",
  tags: ["entries"],
  eleventyComputed: {
    notebook: (data) => at(data)?.notebook,
    pageNo: (data) => at(data)?.pageNo,
    notebookLabel: (data) => (at(data) ? pad(at(data).notebook, 2) : ""),
    pageLabel: (data) => (at(data) ? pad(at(data).pageNo, 3) : ""),
    night: (data) => {
      const p = at(data);
      return p ? isoDate(nightMs(p.notebook, p.pageNo)) : "";
    },
    age: (data) => {
      const p = at(data);
      return p ? ageOn(nightMs(p.notebook, p.pageNo)) : null;
    },
    hand: (data) => (at(data) ? handFor(at(data).notebook) : "adult"),
    // "The Dripping Porcelain Ring of Legs", built from the four name tables.
    title: (data) => {
      const c = data.creature;
      return c
        ? `The ${c.movement} ${c.surface} ${c.form} of ${c.features}`
        : "Untitled";
    },
    permalink: (data) => {
      const p = at(data);
      return p
        ? `/notebook/${pad(p.notebook, 2)}/${pad(p.pageNo, 3)}/`
        : data.permalink;
    },
  },
};
