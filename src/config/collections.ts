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
  /** True if any session post has `pinned: true` in front matter. */
  pinned?: boolean;
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

function isPinnedData(data: Record<string, unknown>): boolean {
  const p = data.pinned;
  return p === true || p === "true" || p === 1 || p === "1";
}

/** Pinned groups first; within each bucket, same order as default case list. */
function compareCaseGroupsForArchive(a: CaseGroup, b: CaseGroup): number {
  const pa = Boolean(a.pinned);
  const pb = Boolean(b.pinned);
  if (pa !== pb) {
    return pa ? -1 : 1;
  }
  return compareCaseGroupsByStartDateDesc(a, b);
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

/** GEN = general / announcements — not listed under Cases. */
function isGenCaseType(data: Record<string, unknown>): boolean {
  return String(data.case_type ?? "").toUpperCase() === "GEN";
}

/** Strip leading article for index sort so "The Velvet Marrow" sorts under V, not T. */
function sortKeyTitle(title: unknown): string {
  return String(title ?? "")
    .trim()
    .replace(/^the\s+/i, "");
}

function sortByTitle(
  a: { data: Record<string, unknown> },
  b: { data: Record<string, unknown> },
): number {
  const ta = sortKeyTitle(a.data.title);
  const tb = sortKeyTitle(b.data.title);
  return ta.localeCompare(tb, "en", { sensitivity: "base" });
}

/** Pinned first; within each bucket, title sort (including “The …” key). */
function sortLoreOrCharacterEntry(
  a: { data: Record<string, unknown> },
  b: { data: Record<string, unknown> },
): number {
  const pa = isPinnedData(a.data);
  const pb = isPinnedData(b.data);
  if (pa !== pb) {
    return pa ? -1 : 1;
  }
  return sortByTitle(a, b);
}

export default {
  posts(collectionApi: CollectionApi) {
    const sorted = collectionApi
      .getFilteredByGlob("**/posts/**/*.md")
      .sort(
        (
          a: { data: Record<string, unknown>; date?: Date },
          b: { data: Record<string, unknown>; date?: Date },
        ) => {
          const pa = isPinnedData(a.data);
          const pb = isPinnedData(b.data);
          if (pa !== pb) {
            return pa ? -1 : 1;
          }
          const tb = b.date ? b.date.getTime() : 0;
          const ta = a.date ? a.date.getTime() : 0;
          return tb - ta;
        },
      );
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
    return collectionApi
      .getFilteredByGlob("**/lore/**/*.md")
      .sort(sortLoreOrCharacterEntry);
  },

  /** Every `*.md` under `characters/`. */
  characters(collectionApi: CollectionApi) {
    return collectionApi
      .getFilteredByGlob("**/characters/**/*.md")
      .sort(sortLoreOrCharacterEntry);
  },

  /**
   * Field notes grouped by permalink title segment: `field-notes/{slug}/{session}/`.
   * One entry per distinct slugified title; `posts` sorted by session (ascending).
   * Groups sorted by case **start date** (first session’s post `date`), newest first;
   * groups with `pinned: true` on any session post are listed first (same date order within pinned).
   * `latestDate` is the most recent post date in the group (for the cases index).
   * Excludes `case_type: GEN` (announcements / non-case field notes).
   */
  caseGroups(collectionApi: CollectionApi) {
    const raw = collectionApi.getFilteredByGlob(
      "**/posts/**/*.md",
    ) as PostLike[];
    const map = new Map<string, CaseGroup>();

    for (const item of raw) {
      const data = item.data;
      if (isGenCaseType(data)) {
        continue;
      }
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
      group.pinned = group.posts.some((p) => isPinnedData(p.data));
    }

    return groups.sort(compareCaseGroupsForArchive);
  },
};
