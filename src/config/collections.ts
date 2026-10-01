/**
 * Collections of notebook pages: in story order and in the order they were
 * posted.
 */

/** Eleventy collection API slice we use. */
type CollectionApi = {
  getFilteredByGlob: (glob: string) => Item[];
};

type Item = {
  data: Record<string, unknown>;
  url?: string;
  date?: Date;
  filePathStem?: string;
};

function dateMs(i: Item): number {
  return i.date ? i.date.getTime() : 0;
}

export default {
  /**
   * Every notebook page in story order. Paths are zero-padded
   * (notebook/01/001), so sorting the path sorts by notebook, then page.
   */
  nights(api: CollectionApi) {
    return api
      .getFilteredByGlob("**/notebook/*/*.md")
      .sort((a, b) =>
        String(a.filePathStem ?? "").localeCompare(String(b.filePathStem ?? "")),
      );
  },

  /**
   * Notebook pages by the day they were posted, oldest first (the order the
   * RSS plugin expects; it reverses for the feed). Same-day posts fall back to
   * story order.
   */
  written(api: CollectionApi) {
    return api
      .getFilteredByGlob("**/notebook/*/*.md")
      .sort(
        (a, b) =>
          dateMs(a) - dateMs(b) ||
          String(a.filePathStem ?? "").localeCompare(String(b.filePathStem ?? "")),
      );
  },

  /**
   * Notebook pages grouped by notebook: index 0 holds notebook 01's pages,
   * in page order. Drives the shelf and each notebook's own page.
   */
  byNotebook(api: CollectionApi) {
    const books: Item[][] = Array.from({ length: 60 }, () => []);
    const pages = api
      .getFilteredByGlob("**/notebook/*/*.md")
      .sort((a, b) =>
        String(a.filePathStem ?? "").localeCompare(String(b.filePathStem ?? "")),
      );
    for (const p of pages) {
      const n = Number(p.data.notebook);
      if (n >= 1 && n <= 60) books[n - 1].push(p);
    }
    return books;
  },
};
