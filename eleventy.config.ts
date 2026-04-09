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

const siteUrl = process.env.URL ?? "http://127.0.0.1:8099";
const siteBase = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;

export default function (
  eleventyConfig: EleventyConfigApi,
): EleventyProjectOptions {
  eleventyConfig.addPlugin(IdAttributePlugin);

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

  Object.keys(shortcodes).forEach((name) => {
    eleventyConfig.addShortcode(
      name,
      shortcodes[name as keyof typeof shortcodes],
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
    (mdLib: { set: (opts: object) => void }) => {
      mdLib.set({ breaks: true });
    },
  );

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
