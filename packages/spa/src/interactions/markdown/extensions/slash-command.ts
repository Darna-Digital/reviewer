/**
 * `/` in an empty paragraph, as a block menu.
 *
 * TipTap's suggestion plugin owns the hard parts — noticing the character,
 * tracking the query as it is typed, tearing down when the caret leaves — so
 * this is only the wiring: which entries match, what mounting the menu means,
 * and which keystrokes the menu gets before the document does.
 *
 * The menu is refused inside a code block: a slash there is a slash.
 */
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import {
  Suggestion,
  type SuggestionOptions,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { matchingBlockCommands } from "../functions/block-catalogue.functions";
import type {
  BlockCommand,
  BlockChain,
} from "../interfaces/markdown.interfaces";
import { SlashMenu, type SlashMenuHandle } from "../components/slash-menu";

type SlashProps = SuggestionProps<BlockCommand, BlockCommand>;

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<BlockCommand, BlockCommand>({
        editor: this.editor,
        char: "/",
        allow: ({ state, range }) =>
          !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => matchingBlockCommands(query),
        command: ({ editor, range, props }) => {
          // The typed `/query` is part of the document until the command runs;
          // deleting it first is what makes the menu feel like a menu.
          const chain = editor.chain().focus().deleteRange(range);
          props.apply(chain as unknown as BlockChain).run();
        },
        render: renderSlashMenu,
      }),
    ];
  },
});

function renderSlashMenu(): ReturnType<
  NonNullable<SuggestionOptions<BlockCommand, BlockCommand>["render"]>
> {
  let menu: ReactRenderer<SlashMenuHandle, SlashProps> | null = null;
  let unmount: (() => void) | null = null;

  return {
    onStart: (props) => {
      menu = new ReactRenderer(SlashMenu, { props, editor: props.editor });
      unmount = props.mount(menu.element);
    },
    onUpdate: (props) => menu?.updateProps(props),
    onKeyDown: ({ event }) => menu?.ref?.onKeyDown(event) ?? false,
    onExit: () => {
      unmount?.();
      menu?.destroy();
      menu = null;
      unmount = null;
    },
  };
}
