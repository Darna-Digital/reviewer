/** Assistant text rendered as markdown, matching the docs preview styling. */
import { memo } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

/**
 * The plugin lists are hoisted, and the component is memoised, for the same
 * reason: this is the most expensive thing the app renders repeatedly.
 *
 * Every render parses the text to an mdast, runs GFM over it, converts to hast,
 * highlights every code block, and builds a React tree for the result. Fresh
 * `[remarkGfm]` / `[rehypeHighlight]` array literals would defeat
 * react-markdown's own internal memoisation on top of that.
 *
 * Memoising on `text` means a settled reply is parsed once and then skipped for
 * the rest of the session, however many tokens land in the message below it.
 */
const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight];

export const ChatMarkdown = memo(function ChatMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div className="markdown min-w-0 text-sm">
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
        {text}
      </Markdown>
    </div>
  );
});
