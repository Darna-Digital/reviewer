/**
 * The handle that appears in the margin beside the block under the pointer.
 *
 * Two buttons: a plus that adds a sibling below, and a grip that both drags the
 * block and, on a click, opens what can be done to it. Everything the menu does
 * is a function in `block-handles`, so this file is only the chrome.
 *
 * The menu hangs off the grip by anchor rather than wrapping it in a trigger,
 * because the grip is also a drag source and a trigger would swallow the
 * pointer press the drag starts from.
 */
import { IconGripVertical, IconPlus } from "@tabler/icons-react";
import type { Editor } from "@tiptap/core";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { convertibleBlockCommands } from "../functions/block-catalogue.functions";
import {
  type BlockTarget,
  canMoveBlock,
  chainInsideBlock,
  duplicateBlock,
  endBlockDrag,
  insertBlockAfter,
  moveBlock,
  removeBlock,
  startBlockDrag,
} from "../functions/block-handles.functions";
import type { BlockChain } from "../interfaces/markdown.interfaces";

/** Blocks with no other shape to take — converting them would mean losing them. */
const FIXED_BLOCKS = ["horizontalRule", "markdownBlock", "table"];

export function BlockGutter({
  editor,
  target,
  top,
  onOpenChange,
  onDone,
}: {
  editor: Editor;
  target: BlockTarget;
  /** Offset from the top of the editor container, in px. */
  top: number;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const grip = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // The container stops tracking the pointer while the menu is up, so the
  // handle does not wander off the block the menu is about.
  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    onOpenChange(open);
  };

  const run = (action: () => void) => {
    action();
    onDone();
  };

  const convertible = FIXED_BLOCKS.includes(target.node.type.name)
    ? []
    : convertibleBlockCommands();

  return (
    <div
      style={{ top }}
      className="absolute left-0 flex w-11 justify-end pt-0.5"
    >
      <GutterButton
        label="Insert block below"
        onClick={() => run(() => insertBlockAfter(editor, target))}
      >
        <IconPlus className="size-4" />
      </GutterButton>

      <GutterButton
        ref={grip}
        label="Drag to move, click for block options"
        draggable
        onDragStart={(event) =>
          startBlockDrag(editor.view, target, event.nativeEvent)
        }
        onDragEnd={() => run(() => endBlockDrag(editor.view))}
        onClick={() => toggleMenu(true)}
      >
        <IconGripVertical className="size-4" />
      </GutterButton>

      <DropdownMenu open={menuOpen} onOpenChange={toggleMenu}>
        <DropdownMenuContent anchor={grip} align="start" className="min-w-48">
          {convertible.length > 0 && (
            <>
              {convertible.map((entry) => (
                <DropdownMenuItem
                  key={entry.id}
                  onClick={() =>
                    run(() =>
                      entry
                        .apply(
                          chainInsideBlock(
                            editor,
                            target
                          ) as unknown as BlockChain
                        )
                        .run()
                    )
                  }
                >
                  <entry.icon className="size-4" />
                  {entry.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            disabled={!canMoveBlock(editor, target, -1)}
            onClick={() => run(() => moveBlock(editor, target, -1))}
          >
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canMoveBlock(editor, target, 1)}
            onClick={() => run(() => moveBlock(editor, target, 1))}
          >
            Move down
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => run(() => duplicateBlock(editor, target))}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => run(() => removeBlock(editor, target))}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function GutterButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      {...props}
    >
      {children}
    </button>
  );
}
