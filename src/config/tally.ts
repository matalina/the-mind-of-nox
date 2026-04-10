/**
 * Renders a row of Font Awesome squares: `current` solid, remainder outline to `total`.
 */
export function tallyHtml(currentRaw: unknown, totalRaw: unknown): string {
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
    `<span class="tally" role="img" aria-label="${current} of ${total}">`,
  ];
  for (let i = 0; i < current; i++) {
    parts.push('<i class="fa-solid fa-square" aria-hidden="true"></i>');
  }
  for (let i = 0; i < empty; i++) {
    parts.push('<i class="fa-regular fa-square" aria-hidden="true"></i>');
  }
  parts.push("</span>");
  return parts.join("");
}
