declare module "@11ty/eleventy-plugin-rss";
declare module "@11ty/eleventy-plugin-id";

/** Main package is JS-only; declare exports this project imports. */
declare module "@11ty/eleventy" {
  export function IdAttributePlugin(
    eleventyConfig: unknown,
    options?: Record<string, unknown>,
  ): void;
}
