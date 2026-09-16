/**
 * The one catalogue of blocks, read by both menus.
 *
 * The slash menu inserts from it and the block handle's "turn into" submenu
 * converts from it, which is why an entry is a description of a block rather
 * than of a menu row: `apply` is the same chain either way, and `convertible`
 * is the only thing the two menus disagree about — a divider or a table can be
 * put in but an existing paragraph cannot be turned into one.
 *
 * Entries only ever touch the `BlockChain` interface, never a live editor, so
 * the catalogue can be exercised against a recording double.
 */
import {
  IconBlockquote,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconLetterT,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconMinus,
  IconTable,
} from "@tabler/icons-react";
import type { BlockCommand } from "../interfaces/markdown.interfaces";

const BASIC = "Basic blocks";
const ADVANCED = "Advanced blocks";

export const BLOCK_COMMANDS: ReadonlyArray<BlockCommand> = [
  {
    id: "paragraph",
    icon: IconLetterT,
    label: "Text",
    description: "Just start writing with plain text.",
    keywords: ["text", "paragraph", "plain", "body"],
    group: BASIC,
    apply: (chain) => chain.clearNodes().setParagraph(),
    convertible: true,
  },
  {
    id: "heading-1",
    icon: IconH1,
    label: "Heading 1",
    description: "Big section heading.",
    keywords: ["heading 1", "h1", "title", "#"],
    group: BASIC,
    apply: (chain) => chain.clearNodes().setHeading({ level: 1 }),
    convertible: true,
  },
  {
    id: "heading-2",
    icon: IconH2,
    label: "Heading 2",
    description: "Medium section heading.",
    keywords: ["heading 2", "h2", "subtitle", "##"],
    group: BASIC,
    apply: (chain) => chain.clearNodes().setHeading({ level: 2 }),
    convertible: true,
  },
  {
    id: "heading-3",
    icon: IconH3,
    label: "Heading 3",
    description: "Small section heading.",
    keywords: ["heading 3", "h3", "###"],
    group: BASIC,
    apply: (chain) => chain.clearNodes().setHeading({ level: 3 }),
    convertible: true,
  },
  {
    id: "bulleted-list",
    icon: IconList,
    label: "Bulleted list",
    description: "Organise items with bullets.",
    keywords: ["bulleted list", "bullet", "unordered", "-"],
    group: BASIC,
    apply: (chain) => chain.clearNodes().toggleBulletList(),
    convertible: true,
  },
  {
    id: "numbered-list",
    icon: IconListNumbers,
    label: "Numbered list",
    description: "Organise items in a sequence.",
    keywords: ["numbered list", "ordered", "number"],
    group: BASIC,
    apply: (chain) => chain.clearNodes().toggleOrderedList(),
    convertible: true,
  },
  {
    id: "todo-list",
    icon: IconListCheck,
    label: "To-do list",
    description: "Track tasks with checkboxes.",
    keywords: ["to-do list", "todo", "task", "checkbox"],
    group: BASIC,
    apply: (chain) => chain.clearNodes().toggleTaskList(),
    convertible: true,
  },
  {
    id: "quote",
    icon: IconBlockquote,
    label: "Quote",
    description: "Capture a quotation.",
    keywords: ["quote", "blockquote", "citation", ">"],
    group: ADVANCED,
    apply: (chain) => chain.clearNodes().toggleBlockquote(),
    convertible: true,
  },
  {
    id: "code",
    icon: IconCode,
    label: "Code",
    description: "Capture a snippet of code.",
    keywords: ["code", "snippet", "monospace", "```"],
    group: ADVANCED,
    apply: (chain) => chain.clearNodes().toggleCodeBlock(),
    convertible: true,
  },
  {
    id: "divider",
    icon: IconMinus,
    label: "Divider",
    description: "Visually separate blocks.",
    keywords: ["divider", "rule", "separator", "---"],
    group: ADVANCED,
    apply: (chain) => chain.setHorizontalRule(),
    convertible: false,
  },
  {
    id: "table",
    icon: IconTable,
    label: "Table",
    description: "A table of rows and columns.",
    keywords: ["table", "grid", "rows", "columns"],
    group: ADVANCED,
    apply: (chain) =>
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
    convertible: false,
  },
];

/**
 * The entries a slash query offers.
 *
 * Prefix matching on each keyword, not substring: typing `li` should reach
 * "List" without also dragging in everything whose description happens to
 * contain those two letters, and a menu that reorders under you as you type is
 * a menu you cannot aim at.
 */
export function matchingBlockCommands(query: string): BlockCommand[] {
  const term = query.trim().toLowerCase();
  if (term === "") return [...BLOCK_COMMANDS];
  return BLOCK_COMMANDS.filter((command) =>
    command.keywords.some((keyword) => keyword.startsWith(term))
  );
}

/** The entries an existing block can be turned into. */
export const convertibleBlockCommands = (): BlockCommand[] =>
  BLOCK_COMMANDS.filter((command) => command.convertible);

/** The menu's sections, in the order the catalogue declares them. */
export function groupedBlockCommands(
  commands: ReadonlyArray<BlockCommand>
): Array<{ group: string; commands: BlockCommand[] }> {
  const groups = new Map<string, BlockCommand[]>();
  for (const command of commands) {
    groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  }
  return [...groups.entries()].map(([group, entries]) => ({
    group,
    commands: entries,
  }));
}
