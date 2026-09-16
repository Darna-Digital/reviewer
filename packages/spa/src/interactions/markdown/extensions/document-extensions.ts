/**
 * The schema the document editor runs on.
 *
 * It is chosen to be exactly what GFM can express, no more: every block here
 * has a markdown spelling, so nothing a user can create is lost when the file
 * is written. Two attributes markdown carries and TipTap's own nodes do not —
 * a fence's info string beyond its language, and a table column's alignment —
 * are added globally rather than by forking the nodes, which keeps the rest of
 * the schema stock.
 *
 * Built once at module scope. The extension list is compiled into a schema on
 * every `useEditor` that receives a new array, and in a split view the editor
 * is rebuilt often enough for that to show.
 */
import { Extension } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableCell, TableHeader, TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit } from "@tiptap/starter-kit";
import { MarkdownBlock } from "./markdown-block";
import { SlashCommand } from "./slash-command";

/**
 * What markdown says about a node that the stock schema has nowhere to keep.
 *
 * `rendered: false` keeps both out of the editor's HTML — they are only ever
 * read back out of the document's JSON, on the way to a file.
 */
const MarkdownAttributes = Extension.create({
  name: "markdownAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["codeBlock"],
        // The rest of a fence's info string: ```ts twoslash keeps "twoslash".
        attributes: { meta: { default: null, rendered: false } },
      },
      {
        types: [TableCell.name, TableHeader.name],
        attributes: { align: { default: null, rendered: false } },
      },
    ];
  },
});

const placeholderFor = (node: { type: { name: string } }): string => {
  if (node.type.name === "heading") return "Heading";
  if (node.type.name === "codeBlock") return "";
  return "Write something, or press / for blocks";
};

export const DOCUMENT_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
    // Markdown has no underline, so offering one would create text that could
    // not be written back.
    underline: false,
    link: {
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  Image.configure({ inline: true, allowBase64: true }),
  MarkdownAttributes,
  MarkdownBlock,
  SlashCommand,
  Placeholder.configure({
    showOnlyCurrent: true,
    placeholder: ({ node, hasAnchor }) =>
      hasAnchor ? placeholderFor(node) : "",
  }),
];
