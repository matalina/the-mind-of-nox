/** Methods on Eleventy’s config object that this project uses. */
export interface EleventyConfigApi {
  addPlugin(plugin: unknown, options?: unknown): void;
  addExtension(extension: string | string[], options: { key: string }): void;
  addTemplateFormats(formats: string | string[]): void;
  addPassthroughCopy(path: string | Record<string, string>): void;
}

/** Return value of the default config function (`dir` and any other top-level options). */
export interface EleventyProjectOptions {
  dir: {
    input?: string;
    output?: string;
    includes?: string;
    layouts?: string;
    data?: string;
    markdownTemplateEngine?: string;
  };
}
