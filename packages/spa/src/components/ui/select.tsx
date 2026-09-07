import { Select as SelectPrimitive } from "@base-ui/react/select";
import { IconCheck, IconChevronDown, IconSelector } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { HIDDEN_WITH_ANCHOR } from "@/components/ui/anchored-popup";
import {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import { TruncatedRow } from "@/components/ui/truncated-text";

function Select<TValue>(props: SelectPrimitive.Root.Props<TValue>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup(props: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  hideIcon = false,
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default";
  /** For icon-only triggers, where a chevron would be more chrome than help. */
  hideIcon?: boolean;
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm whitespace-nowrap text-foreground shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 dark:bg-transparent dark:hover:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      {!hideIcon && <SelectPrimitive.Icon render={<IconSelector />} />}
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  sideOffset = 6,
  align = "start",
  side,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "sideOffset" | "align" | "side">) {
  const { level, className: surface } = useElevation(
    ELEVATION.menu,
    POPUP_SHADOW
  );
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className={cn("isolate z-50 outline-none", HIDDEN_WITH_ANCHOR)}
        sideOffset={sideOffset}
        align={align}
        side={side}
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.ScrollUpArrow className="flex h-6 cursor-default items-center justify-center text-muted-foreground">
          <IconChevronDown className="rotate-180" />
        </SelectPrimitive.ScrollUpArrow>
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-surface={level}
          className={cn(
            "z-50 max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-md p-1 text-popover-foreground outline-none",
            surface,
            className
          )}
          {...props}
        >
          <SurfaceProvider value={level}>{children}</SurfaceProvider>
        </SelectPrimitive.Popup>
        <SelectPrimitive.ScrollDownArrow className="flex h-6 cursor-default items-center justify-center text-muted-foreground">
          <IconChevronDown />
        </SelectPrimitive.ScrollDownArrow>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectGroupLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-2 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <TruncatedRow
      render={
        <SelectPrimitive.Item
          data-slot="select-item"
          className={cn(
            "relative flex w-full min-w-0 cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-elevate data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
            className
          )}
          {...props}
        />
      }
    >
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <IconCheck className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText className="flex min-w-0 items-center gap-2 truncate">
        {children}
      </SelectPrimitive.ItemText>
    </TruncatedRow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
};
