import "tsx/esm";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import type {
  EleventyConfigApi,
  EleventyProjectOptions,
} from "./src/types/eleventy-config";
import { IdAttributePlugin } from "@11ty/eleventy";
import filters from "./src/config/filters";
import shortcodes from "./src/config/shortcodes";
import collections from "./src/config/collections";
import pluginToc from "eleventy-plugin-toc";
import markdownItAnchor from "markdown-it-anchor";

const siteUrl = process.env.URL ?? "http://127.0.0.1:8099";
const siteBase = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;

export default function (
  eleventyConfig: EleventyConfigApi,
): EleventyProjectOptions {
  eleventyConfig.addExtension("11ty.ts", {
    key: "11ty.js",
  });

  eleventyConfig.addTemplateFormats("11ty.ts");

  eleventyConfig.addPassthroughCopy({ "src/assets/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "js" });
  eleventyConfig.addPassthroughCopy({
    "node_modules/@fortawesome/fontawesome-free/css/all.min.css":
      "css/fontawesome.min.css",
  });
  eleventyConfig.addPassthroughCopy({
    "node_modules/@fortawesome/fontawesome-free/webfonts": "webfonts",
  });

  Object.keys(filters).forEach((filterName) => {
    eleventyConfig.addFilter(
      filterName,
      filters[filterName as keyof typeof filters],
    );
  });

  Object.keys(shortcodes.inline).forEach((name) => {
    eleventyConfig.addShortcode(
      name,
      shortcodes.inline[name as keyof typeof shortcodes.inline],
    );
  });

  Object.keys(shortcodes.paired).forEach((name) => {
    eleventyConfig.addPairedShortcode(
      name,
      shortcodes.paired[name as keyof typeof shortcodes.paired],
    );
  });

  Object.keys(collections).forEach((name) => {
    eleventyConfig.addCollection(
      name,
      collections[name as keyof typeof collections],
    );
  });

  // Treat single newlines as <br> (markdown-it `breaks`), so you don’t need two
  // trailing spaces or a blank line between every visual line.
  eleventyConfig.amendLibrary(
    "md",
    (mdLib: {
      set: (opts: object) => void;
      use: (plugin: unknown, opts?: object) => void;
    }) => {
      mdLib.set({ breaks: true });
      // Heading ids must exist *in Markdown output* before layouts run. The TOC
      // filter only matches `h2[id]`, `h3[id]`, … IdAttributePlugin runs later
      // on the full HTML, so it cannot supply ids for `{{ content | toc }}`.
      mdLib.use(markdownItAnchor, {
        slugify: (s: string) =>
          eleventyConfig.getFilter("slugify")(s) as string,
        permalink: false,
      });
    },
  );

  eleventyConfig.addPlugin(pluginToc, {
    tags: ["h2", "h3"],
    wrapper: "nav",
  });
  eleventyConfig.addPlugin(IdAttributePlugin, {
    selector: "h1,h2,h3",
    slugify: eleventyConfig.getFilter("slugify"),
  });
  eleventyConfig.addPlugin(feedPlugin, {
    type: "rss",
    outputPath: "/feed/index.xml",
    collection: {
      name: "posts",
      limit: 0,
    },
    metadata: {
      language: "en",
      title: "The Mind of Nox",
      subtitle: "Field notes — authorized personnel only.",
      base: siteBase,
      author: {
        name: "AJ Hunter",
      },
    },
  });

  return {
    dir: {
      input: "src/www",
      output: "_site",
      includes: "../layouts",
      layouts: "../layouts",
      data: "../data",
      markdownTemplateEngine: "njk",
    },
  };
}
