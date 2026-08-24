import { IconChevronRight, IconFolderPlus } from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { NEW_FILE_TEMPLATES } from "@/interactions/file-actions/functions/file-actions.functions";
import type { PathKind } from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import { cn } from "@/lib/utils";

/**
 * The tree's context menu is hand-rolled — it lives in the slot the tree
 * positions, not in a base-ui portal — so its row and panel styling is shared
 * from here for every entry to wear, wherever it is drawn.
 */
export const TREE_MENU_ITEM =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left outline-none hover:bg-elevate focus:bg-elevate disabled:opacity-40 disabled:hover:bg-transparent";

export const TREE_MENU_PANEL =
  "flex min-w-48 flex-col gap-0.5 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md";

// base-ui's submenu hover delay, so this flyout feels like the app's menus.
const HOVER_OPEN_DELAY = 100;
const HOVER_CLOSE_DELAY = 150;

/**
 * How the menu's document-level key handler reaches this flyout: while the
 * menu is up, the tree swallows every arrow key inside its shadow root before
 * a React handler would hear it, so the capture-phase handler that already
 * owns Up and Down turns ArrowRight and ArrowLeft into these events on the
 * trigger and the flyout panel.
 */
export const SUBMENU_OPEN_EVENT = "byconvo:submenu-open";
export const SUBMENU_CLOSE_EVENT = "byconvo:submenu-close";

/**
 * What was picked from the "New" flyout: what kind of row to draft, and the
 * extension a typed template stamps on a name that doesn't spell one.
 */
export interface NewEntryChoice {
  readonly kind: PathKind;
  readonly extension: string | null;
}

interface NewEntrySubmenuProps {
  readonly onPick: (choice: NewEntryChoice) => void;
}

/**
 * The context menu's "New ▸" entry and its flyout — a plain file, a folder,
 * and the typed templates, each wearing the icon the tree gives that file
 * type. Hover opens it the way the app's menus do; ArrowRight and Enter open
 * it from the keyboard, and ArrowLeft or Escape put focus back on the trigger
 * without closing the menu it hangs off.
 */
export function NewEntrySubmenu({ onPick }: NewEntrySubmenuProps) {
  const [open, setOpen] = useState(false);
  // Measured on open: the flyout hangs to the right unless the viewport ends
  // there, which is where a tree pinned to a right-hand sidebar puts it.
  const [side, setSide] = useState<"right" | "left">("right");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const later = (action: () => void, delay: number) => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(action, delay);
  };

  // Keyboard opens want the first entry focused; the flyout only exists after
  // the open commits, so the wish is parked here for the layout effect below.
  const focusOnOpenRef = useRef(false);

  const openNow = (focusFirst: boolean) => {
    setSide("right");
    if (focusFirst) focusOnOpenRef.current = true;
    setOpen(true);
  };

  const closeNow = (refocusTrigger: boolean) => {
    setOpen(false);
    if (refocusTrigger) triggerRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const flyout = flyoutRef.current;
    if (flyout === null) return;
    if (flyout.getBoundingClientRect().right > window.innerWidth - 8) {
      setSide("left");
    }
    if (focusOnOpenRef.current) {
      focusOnOpenRef.current = false;
      flyout.querySelector<HTMLButtonElement>("[role='menuitem']")?.focus();
    }
  }, [open]);

  // ArrowRight reaches into the flyout, relayed by the menu's key handler.
  useEffect(() => {
    const trigger = triggerRef.current;
    if (trigger === null) return;
    const onOpen = () => openNow(true);
    trigger.addEventListener(SUBMENU_OPEN_EVENT, onOpen);
    return () => trigger.removeEventListener(SUBMENU_OPEN_EVENT, onOpen);
  }, []);

  // ArrowLeft hands focus back to the trigger, the same way.
  useEffect(() => {
    if (!open) return;
    const flyout = flyoutRef.current;
    if (flyout === null) return;
    const onClose = () => closeNow(true);
    flyout.addEventListener(SUBMENU_CLOSE_EVENT, onClose);
    return () => flyout.removeEventListener(SUBMENU_CLOSE_EVENT, onClose);
  }, [open]);

  const pick = (choice: NewEntryChoice) => {
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    onPick(choice);
  };

  const item = (
    label: string,
    icon: React.ReactNode,
    choice: NewEntryChoice,
    hint?: string
  ) => (
    <button
      key={label}
      role="menuitem"
      className={cn(TREE_MENU_ITEM, "whitespace-nowrap")}
      onClick={() => pick(choice)}
    >
      {icon}
      {label}
      {hint !== undefined && (
        <span className="ml-auto pl-4 text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </button>
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => later(() => openNow(false), HOVER_OPEN_DELAY)}
      onMouseLeave={() => later(() => closeNow(false), HOVER_CLOSE_DELAY)}
    >
      <button
        ref={triggerRef}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(TREE_MENU_ITEM, open && "bg-elevate")}
        onClick={() => openNow(true)}
      >
        <FileTypeIcon path="new" className="size-3.5 opacity-70" />
        New
        <IconChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div
          ref={flyoutRef}
          role="menu"
          className={cn(
            TREE_MENU_PANEL,
            "absolute -top-1 z-10",
            side === "right" ? "left-full ml-0.5" : "right-full mr-0.5"
          )}
        >
          {item("File", <FileTypeIcon path="new" className="size-3.5" />, {
            kind: "file",
            extension: null,
          })}
          {item(
            "Folder",
            <IconFolderPlus className="size-3.5 shrink-0 opacity-70" />,
            { kind: "directory", extension: null }
          )}
          <div role="separator" className="my-0.5 h-px bg-border" />
          {NEW_FILE_TEMPLATES.map((template) =>
            item(
              template.label,
              <FileTypeIcon
                path={`new${template.extension}`}
                className="size-3.5"
              />,
              { kind: "file", extension: template.extension },
              template.extension
            )
          )}
        </div>
      )}
    </div>
  );
}
