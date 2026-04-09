import slugify from "slugify";

/** Eleventy collection API slice we use (avoid coupling to full types). */
type CollectionApi = {
  getFilteredByGlob: (glob: string) => Array<{
    data: Record<string, unknown>;
    date?: Date;
  }>;
};

/** Must match `slugify` filter in [src/config/filters.ts](src/config/filters.ts) and post permalink `title | slugify`. */
function titleSlug(str: unknown): string {
  return slugify(String(str ?? ""), {
    lower: true,
    strict: true,
    replacement: "-",
  });
}

function sessionNumber(data: Record<string, unknown>): number {
  const s = data.session;
  if (typeof s === "number" && !Number.isNaN(s)) {
    return s;
  }
  if (typeof s === "string") {
    const n = Number.parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

type PostLike = {
  data: Record<string, unknown>;
  date?: Date;
};

type CaseGroup = {
  slug: string;
  title: string;
  posts: PostLike[];
  /** Most recent post date in this case (for index line). */
  latestDate?: Date;
};

/** First session = lowest session# after sort; its post `date` is the case start. */
function startDateMs(group: CaseGroup): number {
  const first = group.posts[0];
  return first?.date ? first.date.getTime() : 0;
}

/** Newest-started cases first (by first session date, descending). */
function compareCaseGroupsByStartDateDesc(a: CaseGroup, b: CaseGroup): number {
  return startDateMs(b) - startDateMs(a);
}

function latestDateInGroup(posts: PostLike[]): Date | undefined {
  let max: Date | undefined;
  for (const p of posts) {
    if (!p.date) {
      continue;
    }
    if (!max || p.date.getTime() > max.getTime()) {
      max = p.date;
    }
  }
  return max;
}

function sortByTitle(
  a: { data: Record<string, unknown> },
  b: { data: Record<string, unknown> },
): number {
  const ta = String(a.data.title ?? "");
  const tb = String(b.data.title ?? "");
  return ta.localeCompare(tb, "en", { sensitivity: "base" });
}

export default {
  posts(collectionApi: CollectionApi) {
    const sorted = collectionApi
      .getFilteredByGlob("**/posts/**/*.md")
      .sort((a: { date?: Date }, b: { date?: Date }) => {
        const tb = b.date ? b.date.getTime() : 0;
        const ta = a.date ? a.date.getTime() : 0;
        return tb - ta;
      });
    for (const item of sorted) {
      const data = item.data as Record<string, unknown>;
      const hasImage =
        typeof data.image === "string" && data.image.trim() !== "";
      data.indexPolaroid = hasImage ? Math.random() < 0.5 : false;
    }
    return sorted;
  },

  /** Every `*.md` under `lore/` (index is `lore/index.njk`, not markdown). */
  lore(collectionApi: CollectionApi) {
    return collectionApi.getFilteredByGlob("**/lore/**/*.md").sort(sortByTitle);
  },

  /** Every `*.md` under `characters/`. */
  characters(collectionApi: CollectionApi) {
    return collectionApi
      .getFilteredByGlob("**/characters/**/*.md")
      .sort(sortByTitle);
  },

  /**
   * Field notes grouped by permalink title segment: `field-notes/{slug}/{session}/`.
   * One entry per distinct slugified title; `posts` sorted by session (ascending).
   * Groups sorted by case **start date** (first session’s post `date`), newest first.
   * `latestDate` is the most recent post date in the group (for the cases index).
   */
  caseGroups(collectionApi: CollectionApi) {
    const raw = collectionApi.getFilteredByGlob(
      "**/posts/**/*.md",
    ) as PostLike[];
    const map = new Map<string, CaseGroup>();

    for (const item of raw) {
      const data = item.data;
      const title = String(data.title ?? "");
      const slug = titleSlug(title);
      if (slug === "") {
        continue;
      }
      let group = map.get(slug);
      if (!group) {
        group = { slug, title, posts: [] };
        map.set(slug, group);
      }
      group.posts.push(item);
    }

    const groups = Array.from(map.values());
    for (const group of groups) {
      group.posts.sort((a, b) => sessionNumber(a.data) - sessionNumber(b.data));
      group.latestDate = latestDateInGroup(group.posts);
    }

    return groups.sort(compareCaseGroupsByStartDateDesc);
  },
};
