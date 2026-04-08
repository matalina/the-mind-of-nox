import "tsx/esm";
import pluginRss from "@11ty/eleventy-plugin-rss";
import type {
  EleventyConfigApi,
  EleventyProjectOptions,
} from "./src/types/eleventy-config.js";
import { IdAttributePlugin } from "@11ty/eleventy";
import filters from "./src/config/filters.js";

export default function (
  eleventyConfig: EleventyConfigApi,
): EleventyProjectOptions {
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(IdAttributePlugin);

  eleventyConfig.addExtension("11ty.ts", {
    key: "11ty.js",
  });
  eleventyConfig.addTemplateFormats("11ty.ts");
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "js" });

  Object.keys(filters).forEach((filterName) => {
    eleventyConfig.addFilter(
      filterName,
      filters[filterName as keyof typeof filters],
    );
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
