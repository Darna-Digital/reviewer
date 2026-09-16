/**
 * Markdown text in, document out, and back again.
 *
 * The two processors are built once and reused: remark compiles its plugin
 * chain on construction, and rebuilding it per keystroke in a split view —
 * where every character typed on one side re-renders the other — was the whole
 * cost of the feature.
 *
 * The writing options are chosen to look like markdown people actually check
 * in, so that re-saving a file the editor has merely opened produces as small a
 * diff as possible: dashes for bullets and rules, fenced code, one-space list
 * indentation.
 */
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import type { DocNode } from "../interfaces/markdown.interfaces";
import { docToMdast } from "./doc-to-mdast.functions";
import { mdastToDoc } from "./mdast-to-doc.functions";

const reader = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // Without this a YAML header parses as a rule followed by a setext heading,
  // and saving would rewrite the front of every document that has one.
  .use(remarkFrontmatter, ["yaml", "toml"]);

const writer = unified().use(remarkGfm).use(remarkStringify, {
  bullet: "-",
  listItemIndent: "one",
  rule: "-",
  fences: true,
  emphasis: "_",
  strong: "*",
});

export const markdownToDoc = (text: string): DocNode =>
  mdastToDoc(reader.parse(text), text);

export const docToMarkdown = (doc: DocNode): string =>
  writer.stringify(docToMdast(doc));
