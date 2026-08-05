import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";
import {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import { IconChevronRight, IconCheck } from "@tabler/icons-react";
import { TruncatedRow } from "@/components/ui/truncated-text";

/** base-ui's `SubmenuTrigger.delay` default. */
const SUBMENU_HOVER_DELAY = 100;

const menuItem =
  "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden select-none focus:bg-elevate focus:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  children,
  anchor,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    | "align"
    | "alignOffset"
    | "side"
    | "sideOffset"
    // An anchor lets a menu hang off something other than a trigger — the
    // pointer, for a context menu over a symbol in the code.
    | "anchor"
  >) {
  const { level, className: surface } = useElevation(
    ELEVATION.menu,
    POPUP_SHADOW
  );
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          data-surface={level}
          className={cn(
            "z-50 max-h-(--available-height) min-w-72 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl p-1 text-popover-foreground duration-100 outline-none data-[side=bottom]:slide-in-from-top-1 data-[side=inline-end]:slide-in-from-left-1 data-[side=inline-start]:slide-in-from-right-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-[0.98]",
            surface,
            className
          )}
          {...props}
        >
          <SurfaceProvider value={level}>{children}</SurfaceProvider>
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1 text-xs text-muted-foreground data-inset:pl-7",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  children,
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <TruncatedRow
      render={
        <MenuPrimitive.Item
          data-slot="dropdown-menu-item"
          data-inset={inset}
          data-variant={variant}
          className={cn(
            menuItem,
            "group/dropdown-menu-item data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive",
            className
          )}
          {...props}
        />
      }
    >
      {children}
    </TruncatedRow>
  );
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  return (
    // Hovering here opens the submenu after 100ms, and the two must never be up
    // together; waiting longer than that lets the submenu win outright rather
    // than flashing a tooltip that the submenu immediately dismisses.
    <TruncatedRow
      delay={SUBMENU_HOVER_DELAY + 50}
      render={
        <MenuPrimitive.SubmenuTrigger
          data-slot="dropdown-menu-sub-trigger"
          data-inset={inset}
          className={cn(
            menuItem,
            "data-inset:pl-7 data-popup-open:bg-elevate-strong data-popup-open:text-foreground data-open:bg-elevate-strong data-open:text-foreground",
            className
          )}
          {...props}
        />
      }
    >
      {/* Flex-1 wrapper so an `ml-auto` summary sits flush against the
          chevron instead of sharing free space with a second `ml-auto`. */}
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </TruncatedRow>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      // Cap width so long labels can't grow the popup past `w-*` callers;
      // truncation on items then ellipsizes instead of overscrolling.
      className={cn("w-72 max-w-72 min-w-0", className)}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean;
}) {
  return (
    <TruncatedRow
      render={
        <MenuPrimitive.CheckboxItem
          data-slot="dropdown-menu-checkbox-item"
          data-inset={inset}
          className={cn(menuItem, "pr-8 data-inset:pl-7", className)}
          checked={checked}
          {...props}
        />
      }
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <IconCheck />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </TruncatedRow>
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  return (
    <TruncatedRow
      render={
        <MenuPrimitive.RadioItem
          data-slot="dropdown-menu-radio-item"
          data-inset={inset}
          className={cn(
            menuItem,
            "w-full min-w-0 pr-8 data-inset:pl-7",
            className
          )}
          {...props}
        />
      }
    >
      {/* Truncate on the text node — `truncate` on a flex parent does nothing. */}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <IconCheck />
        </MenuPrimitive.RadioItemIndicator>
      </span>
    </TruncatedRow>
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
