/** Captured once per Eleventy build; available in templates as `build`. */
const builtAt = new Date();

export default {
  /** ISO 8601, e.g. for machine use or `datetime` attribute */
  iso: builtAt.toISOString(),
  /** Human-readable in en-US */
  formatted: builtAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
};
