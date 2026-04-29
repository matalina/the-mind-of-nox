import slugify from "slugify";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typeSlug(type: string): string {
  const slug = slugify(type.trim(), {
    lower: true,
    strict: true,
    replacement: "-",
  });
  return slug || "default";
}

/** Color family for sticky-note chrome (from canonical sentence type). */
export type SentenceTheme = "blue" | "green" | "red" | "yellow" | "magenta";

const THEME_BY_CANONICAL: Record<string, SentenceTheme> = {
  info: "blue",
  character: "green",
  wound: "red",
  creature: "red",
  danger: "red",
  location: "blue",
  item: "blue",
  insight: "yellow",
  ai: "magenta",
};

const DEFAULT_ICON_BY_CANONICAL: Record<string, string> = {
  info: "fa-scroll",
  character: "fa-user",
  wound: "fa-heart-crack",
  creature: "fa-dragon",
  danger: "fa-skull",
  location: "fa-map-pin",
  item: "fa-wand-sparkles",
  insight: "fa-lightbulb",
  ai: "fa-microchip",
};

/** Maps author-facing type string → canonical type; optional Font Awesome `fa-*` icon override. */
const TYPE_ALIASES: Record<string, { canonical: string; icon?: string }> = {
  scene: { canonical: "info", icon: "fa-image" },
  npc: { canonical: "character" },
  ward: { canonical: "character" },
  stain: { canonical: "wound" },
  wounds: { canonical: "wound" },
  species: { canonical: "character" },
  type: { canonical: "character" },
  encounter: { canonical: "danger" },
  faction: { canonical: "info", icon: "fa-flag" },
  party: { canonical: "character" },
  dungeon: { canonical: "danger" },
  lair: { canonical: "danger" },
  room: { canonical: "location" },
  armor: { canonical: "item" },
  resource: { canonical: "item" },
  weapon: { canonical: "item" },
  trap: { canonical: "danger" },
  consumeable: { canonical: "danger" },
  consumable: { canonical: "danger" },
  spell: { canonical: "info", icon: "fa-star-and-crescent" },
  quest: { canonical: "insight", icon: "fa-puzzle-piece" },
};

function resolveSentenceType(raw: string): {
  canonical: string;
  theme: SentenceTheme;
  iconClass: string;
} {
  const key = raw.trim().toLowerCase();

  if (!key) {
    return {
      canonical: "info",
      theme: "blue",
      iconClass: "fa-solid fa-scroll",
    };
  }

  let canonical: string;
  let iconOverride: string | undefined;

  const alias = TYPE_ALIASES[key];
  if (alias) {
    canonical = alias.canonical;
    iconOverride = alias.icon;
  } else if (THEME_BY_CANONICAL[key]) {
    canonical = key;
  } else {
    canonical = "info";
  }

  const theme = THEME_BY_CANONICAL[canonical] ?? "blue";
  const faIcon =
    iconOverride ?? DEFAULT_ICON_BY_CANONICAL[canonical] ?? "fa-scroll";
  const iconClass = `fa-solid ${faIcon}`;

  return { canonical, theme, iconClass };
}

/** Random row layout + tilt preset (1–5), chosen once per shortcode invocation at build time. */
function randomStickynoteRowClass(): string {
  const n = Math.floor(Math.random() * 5) + 1;
  return `evidence-tag-row--stickynote-${n}`;
}

/**
 * Sticky-note / paper markup for the `sentence` (inline) and `note` (paired) shortcodes.
 *
 * `variant` picks the chrome:
 *   - "sticky" (default): square sticky-note with random tilt + offset (inline `sentence` shortcode).
 *   - "paper":   wider, paper-with-tape look (paired `note` shortcode).
 *
 * `bodyIsHtml=true` skips escaping when the caller pre-rendered markdown to HTML.
 */
export function sentenceTagHtml(
  type: string,
  title: string,
  body: string,
  bodyIsHtml = false,
  variant: "sticky" | "paper" = "sticky",
): string {
  const rawType = type ?? "";
  const slug = typeSlug(rawType);
  const { canonical, theme, iconClass } = resolveSentenceType(rawType);
  const rowClass =
    variant === "paper" ? "evidence-tag-row--paper" : randomStickynoteRowClass();
  const variantClass =
    variant === "paper" ? "evidence-tag--paper" : "evidence-tag--sticky";
  const escTypeAttr = escapeHtml(rawType);
  const escCanonical = escapeHtml(canonical);
  const displayType = rawType.trim() || "default";
  const escTypeLabel = escapeHtml(displayType);
  const rawTitle = (title ?? "").trim();
  const titleHtml = rawTitle
    ? `<span class="evidence-tag__title">${escapeHtml(rawTitle)}</span>`
    : "";
  const bodyHtml = bodyIsHtml ? (body ?? "") : escapeHtml(body ?? "");

  return `<span class="evidence-tag-row ${rowClass}"><span class="evidence-tag ${variantClass} evidence-tag--${slug} evidence-tag--theme-${theme}" data-evidence-type="${escTypeAttr}" data-sentence-canonical="${escCanonical}"><span class="evidence-tag__body"><span class="evidence-tag__head"><span class="evidence-tag__icon"><i class="${iconClass}" aria-hidden="true"></i></span><span class="evidence-tag__type">${escTypeLabel}</span>${titleHtml}</span><span class="evidence-tag__text">${bodyHtml}</span></span></span></span>`;
}
