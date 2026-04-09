import { youtubeEmbedHtml } from "./youtube";

export default {
  youtube(url: string) {
    return youtubeEmbedHtml(url);
  },
};
