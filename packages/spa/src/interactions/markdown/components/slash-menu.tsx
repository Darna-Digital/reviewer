/**
 * The block menu the slash key opens.
 *
 * It takes the arrow keys, Enter and Tab through an imperative handle rather
 * than a listener of its own: the caret is still in the document, so the menu
 * never has focus and only sees the keystrokes the suggestion plugin hands it.
 *
 * `onMouseDown` is prevented on every row, or clicking one would blur the
 * editor and close the menu before the click landed.
 */
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { groupedBlockCommands } from "../functions/block-catalogue.functions";
import type { BlockCommand } from "../interfaces/markdown.interfaces";
import { cn } from "@/lib/utils";

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

type SlashMenuProps = SuggestionProps<BlockCommand, BlockCommand> & {
  ref?: Ref<SlashMenuHandle>;
};

export function SlashMenu({ items, command, query, ref }: SlashMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeQuery, setActiveQuery] = useState(query);
  const activeItem = useRef<HTMLButtonElement>(null);

  // A new query is a new list, so the highlight goes back to the top with it.
  if (activeQuery !== query) {
    setActiveQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    activeItem.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false;
      switch (event.key) {
        case "ArrowDown":
          setActiveIndex((index) => (index + 1) % items.length);
          return true;
        case "ArrowUp":
          setActiveIndex((index) => (index - 1 + items.length) % items.length);
          return true;
        case "Enter":
        case "Tab":
          command(items[activeIndex] ?? items[0]);
          return true;
        default:
          return false;
      }
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
        No blocks found
      </div>
    );
  }

  return (
    <div className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
      {groupedBlockCommands(items).map(({ group, commands }) => (
        <div key={group}>
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {group}
          </p>
          {commands.map((entry) => {
            const index = items.indexOf(entry);
            const active = index === activeIndex;
            return (
              <button
                key={entry.id}
                ref={active ? activeItem : null}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => command(entry)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left",
                  active && "bg-accent text-accent-foreground"
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  <entry.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {entry.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
