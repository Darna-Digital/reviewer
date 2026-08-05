/**
 * The right-click menu over a symbol.
 *
 * On the app's menu primitive, so it behaves like every other menu: arrow keys
 * and typeahead move between items, Escape and an outside press close it, and
 * focus goes back where it came from. The hand-rolled version this replaces did
 * none of that — arrow keys went to whatever the browser thought came next in
 * the document, which was a button in the file header.
 *
 * It hangs off the pointer rather than off the token, the way context menus do.
 */
import { IconLoader2 } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  /** Quick fixes are still being fetched. */
  loading: boolean;
  onClose: () => void;
}

export function SymbolMenu({
  anchor,
  entries,
  loading,
  onClose,
}: SymbolMenuProps) {
  const navigation = entries.filter((entry) => entry.group !== "fix");
  const fixes = entries.filter((entry) => entry.group === "fix");

  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DropdownMenuContent
        anchor={anchor}
        side="bottom"
        align="start"
        sideOffset={2}
        className="max-w-[26rem] min-w-[15rem]"
      >
        {navigation.map((entry) => (
          <DropdownMenuItem key={entry.id} onClick={entry.run}>
            {entry.label}
          </DropdownMenuItem>
        ))}
        {(fixes.length > 0 || loading) && <DropdownMenuSeparator />}
        {loading && (
          <p className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <IconLoader2 className="size-3.5 animate-spin" />
            Looking for fixes…
          </p>
        )}
        {fixes.map((entry) => (
          <DropdownMenuItem key={entry.id} onClick={entry.run}>
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
