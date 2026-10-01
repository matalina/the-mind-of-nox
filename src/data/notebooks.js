/** All 60 notebooks, in order, for the shelf and each notebook's own page. */

import {
  NOTEBOOK_COUNT,
  pad,
  nightMs,
  isoDate,
  ageOn,
  handFor,
  placeFor,
  pagesIn,
} from "../config/notebook-math.js";

export default Array.from({ length: NOTEBOOK_COUNT }, (_, i) => {
  const number = i + 1;
  const first = nightMs(number, 1);
  const last = nightMs(number, pagesIn(number));
  return {
    number,
    label: pad(number, 2),
    firstNight: isoDate(first),
    lastNight: isoDate(last),
    ageStart: ageOn(first),
    ageEnd: ageOn(last),
    pages: pagesIn(number),
    hand: handFor(number),
    place: placeFor(number),
    // 0 for the newest notebook, 1 for the oldest. Drives how worn a cover looks.
    wear: ((NOTEBOOK_COUNT - number) / (NOTEBOOK_COUNT - 1)).toFixed(2),
  };
});
