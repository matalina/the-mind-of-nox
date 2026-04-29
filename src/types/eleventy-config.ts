/** Methods on Eleventy’s config object that this project uses. */
export interface EleventyConfigApi {
  addPlugin(plugin: unknown, options?: unknown): void;
  addExtension(extension: string | string[], options: { key: string }): void;
  addTemplateFormats(formats: string | string[]): void;
  addPassthroughCopy(path: string | Record<string, string>): void;
  addFilter(filterName: string, filterFunction: (...args: any[]) => any): void;
  /** Retrieve a filter added via `addFilter` (e.g. for plugins). */
  getFilter(filterName: string): (...args: any[]) => any;
  addShortcode(
    shortcodeName: string,
    shortcodeFunction: (...args: any[]) => any,
  ): void;
  addPairedShortcode(
    shortcodeName: string,
    shortcodeFunction: (...args: any[]) => any,
  ): void;
  addCollection(
    collectionName: string,
    collectionFunction: (...args: any[]) => any,
  ): void;
  amendLibrary(
    engineName: string,
    callback: (libraryInstance: {
      set: (opts: object) => void;
      use: (plugin: unknown, opts?: object) => void;
    }) => void,
  ): void;
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
