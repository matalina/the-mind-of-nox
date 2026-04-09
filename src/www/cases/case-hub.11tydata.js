/** Data for [case-hub.njk](case-hub.njk) — title from paginated `case` group. */
export default {
  eleventyComputed: {
    title: (data) => {
      const c = data.case;
      return c && typeof c.title === "string" ? c.title : "Case";
    },
  },
};
