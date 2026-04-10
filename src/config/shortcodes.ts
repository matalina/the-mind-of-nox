import { sentenceTagHtml } from "./sentence-tag";
import { tallyHtml } from "./tally";
import { youtubeEmbedHtml } from "./youtube";

export default {
  sentence(type: string, sentence: string) {
    return sentenceTagHtml(type, sentence);
  },
  tally(current: string | number, total: string | number) {
    return tallyHtml(current, total);
  },
  youtube(url: string) {
    return youtubeEmbedHtml(url);
  },
};
