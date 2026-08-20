/**
 * The completion list, floating at the caret.
 *
 * On the app's popover, for the styling and dismissal every other surface gets,
 * with two deliberate departures.
 *
 * It never takes focus. The user is mid-word; focus has to stay in the editor
 * so the next keystroke lands in the buffer, which is why the list is wired up
 * as a listbox the editor drives rather than one the user tabs into. The arrow
 * keys, Enter and Escape are handled by the hook that owns the list.
 *
 * And it hangs off the caret, re-measured as the view moves, rather than off a
 * trigger element — there is nothing in the DOM that *is* the caret.
 */
import { useLayoutEffect, useRef } from "react";
import type { CompletionItem } from "@byconvo/core/language";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { VirtualAnchor } from "../functions/anchors";

/** Rows visible before the list scrolls. */
const VISIBLE_ROWS = 9;

interface CompletionPopupProps {
  anchor: () => VirtualAnchor | null;
  items: ReadonlyArray<CompletionItem>;
  selected: number;
  onSelect: (index: number) => void;
  onAccept: (index: number) => void;
  onClose: () => void;
}

export function CompletionPopup({
  anchor,
  items,
  selected,
  onSelect,
  onAccept,
  onClose,
}: CompletionPopupProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keyboard navigation moves the highlight past the visible rows.
  useLayoutEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (items.length === 0) return null;

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverContent
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={8}
        // Focus belongs to the editor for as long as the user is typing.
        initialFocus={false}
        finalFocus={false}
        className="w-auto max-w-[32rem] min-w-[18rem] gap-0 overflow-hidden p-0"
        // The caret must stay where it is; the editor clears it on a press.
        onPointerDown={(event) => event.preventDefault()}
        // A press outside the list retires it — see `useCompletions`. This is
        // how a press *on* a row is told apart from one that dismisses it.
        data-completion-popup=""
      >
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Completions"
          // Same geometry as the rows on a symbol card: a one-unit gutter with
          // rounded rows inside it, so the two lists read as one family.
          className="overflow-y-auto p-1"
          style={{ maxHeight: `${VISIBLE_ROWS * 1.5}rem` }}
        >
          {items.map((item, index) => (
            <li
              key={`${item.label}:${item.source}:${index}`}
              data-index={index}
              role="option"
              aria-selected={index === selected}
              className={cn(
                "flex cursor-default items-baseline gap-2.5 rounded-sm px-2 py-1 text-left text-xs",
                index === selected ? "bg-elevate" : "hover:bg-elevate/60"
              )}
              onPointerEnter={() => onSelect(index)}
              onClick={() => onAccept(index)}
            >
              {/* A fixed column rather than a chip: the kinds line up, which
                  is what makes a long list scannable. */}
              <span className="w-16 shrink-0 truncate text-[10px] tracking-wide text-muted-foreground uppercase">
                {item.kind}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                {item.label}
              </span>
              {item.source.length > 0 && (
                // The symbol is not in scope; accepting it adds the import.
                <span className="max-w-[12rem] shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                  {item.source}
                </span>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
