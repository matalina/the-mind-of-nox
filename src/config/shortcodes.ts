import MarkdownIt from "markdown-it";
import { sentenceTagHtml } from "./sentence-tag";
import { tallyHtml } from "./tally";
import { youtubeEmbedHtml } from "./youtube";

const inlineMd = new MarkdownIt({ html: false, breaks: true, linkify: true });

function renderInlineMarkdown(src: string): string {
  const trimmed = (src ?? "").replace(/^\s+|\s+$/g, "");
  if (!trimmed) return "";
  // `renderInline` skips block-level tokens (no <p> wrapping). Paragraph breaks
  // become `<br><br>` so multi-paragraph callout bodies still get visual spacing
  // inside the sticky-note <span>.
  const withBreaks = trimmed.replace(/\n{2,}/g, "\n\n");
  const html = inlineMd.renderInline(withBreaks);
  return html.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
}

export default {
  inline: {
    sentence(type: string, body: string) {
      return sentenceTagHtml(type, "", body);
    },
    tally(
      type: string,
      current: string | number,
      total: string | number,
    ) {
      return tallyHtml(type, current, total);
    },
    youtube(url: string) {
      return youtubeEmbedHtml(url);
    },
  },
  paired: {
    note(body: string, type: string, title = "") {
      return sentenceTagHtml(
        type,
        title,
        renderInlineMarkdown(body),
        true,
        "paper",
      );
    },
  },
};
