/**
 * Renders a row of Font Awesome glyphs: `current` solid, remainder outline to `total`.
 * `type` picks the glyph: boxes → square, circles → circle, clocks → clock.
 */

type TallyType = "boxes" | "circles" | "clocks";

const ICON_BY_TYPE: Record<TallyType, string> = {
  boxes: "fa-square",
  circles: "fa-circle",
  clocks: "fa-clock",
};

function resolveType(raw: unknown): TallyType {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (key === "circles" || key === "clocks") return key;
  return "boxes";
}

export function tallyHtml(
  typeRaw: unknown,
  currentRaw: unknown,
  totalRaw: unknown,
): string {
  const type = resolveType(typeRaw);
  const icon = ICON_BY_TYPE[type];

  let current = Math.trunc(Number(currentRaw));
  let total = Math.trunc(Number(totalRaw));
  if (!Number.isFinite(current) || !Number.isFinite(total)) {
    return "";
  }
  if (total < 0) {
    total = 0;
  }
  if (current < 0) {
    current = 0;
  }
  if (current > total) {
    current = total;
  }

  const empty = total - current;
  const parts: string[] = [
    `<span class="tally tally--${type}" role="img" aria-label="${current} of ${total}">`,
  ];
  for (let i = 0; i < current; i++) {
    parts.push(`<i class="fa-solid ${icon}" aria-hidden="true"></i>`);
  }
  for (let i = 0; i < empty; i++) {
    parts.push(`<i class="fa-regular ${icon}" aria-hidden="true"></i>`);
  }
  parts.push("</span>");
  return parts.join("");
}
