/**
 * The right-click menu over a symbol.
 *
 * On the app's menu primitive, so it behaves like every other menu: arrow keys
 * and typeahead move between items, Escape and an outside press close it, and
 * focus goes back where it came from. The hand-rolled version this replaces did
 * none of that — arrow keys went to whatever the browser thought came next in
 * the document, which was a button in the file header.
 *
 * It hangs off the pointer rather than off the token, the way context menus do,
 * and is the context-menu root for the same reason — see there for what a
 * pointer-anchored menu needs that a trigger-anchored one does not.
 */
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { VirtualAnchor } from "../functions/anchors";

export interface SymbolMenuEntry {
  readonly id: string;
  readonly label: string;
  /** Entries in the `fix` group are separated from the navigation ones. */
  readonly group?: "fix";
  readonly run: () => void;
}

interface SymbolMenuProps {
  anchor: VirtualAnchor;
  entries: ReadonlyArray<SymbolMenuEntry>;
  onClose: () => void;
}

export function SymbolMenu({ anchor, entries, onClose }: SymbolMenuProps) {
  const navigation = entries.filter((entry) => entry.group !== "fix");
  const fixes = entries.filter((entry) => entry.group === "fix");

  return (
    <ContextMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ContextMenuContent
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={2}
        className="max-w-[26rem] min-w-[15rem]"
      >
        {navigation.map((entry) => (
          <ContextMenuItem key={entry.id} onClick={entry.run}>
            {entry.label}
          </ContextMenuItem>
        ))}
        {fixes.length > 0 && <ContextMenuSeparator />}
        {fixes.map((entry) => (
          <ContextMenuItem key={entry.id} onClick={entry.run}>
            {entry.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
