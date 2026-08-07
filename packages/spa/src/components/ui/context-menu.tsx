/**
 * A menu that hangs off the pointer instead of a trigger.
 *
 * Base UI's menu closes itself when the pointer leaves the popup — the
 * behaviour that lets a menubar or submenu follow the mouse — and only skips it
 * for a menu it knows is a context menu. A menu placed beside the cursor is
 * "left" the instant it is positioned, so anything raised by a right-click has
 * to be this root or it dismisses itself a moment after opening.
 *
 * Being the context-menu root also gives the press that opened it a grace
 * period before an outside press can dismiss it, and positions it against the
 * viewport, which is what a pointer rectangle is measured in.
 *
 * Only the root differs; every part below it is the same primitive the dropdown
 * menu is built from, so the content and items come from there.
 */
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

export {
  DropdownMenuContent as ContextMenuContent,
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuLabel as ContextMenuLabel,
  DropdownMenuSeparator as ContextMenuSeparator,
} from "./dropdown-menu";
export { ContextMenu };
