import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { IconCheck, IconSearch, IconSelector } from "@tabler/icons-react";

import { cn } from "@/lib/utils";
import { HIDDEN_WITH_ANCHOR } from "@/components/ui/anchored-popup";
import {
  ELEVATION,
  POPUP_SHADOW,
  SurfaceProvider,
  useElevation,
} from "@/lib/surface-context";
import { TruncatedRow } from "@/components/ui/truncated-text";

/**
 * Combobox — a searchable single-select built on Base UI's `Combobox`, styled to
 * match the `Select` primitive. The closed control is a `ComboboxTrigger`; the
 * popup carries a filter `ComboboxInput` above the scrollable list. Base UI does
 * the filtering internally from the `items` passed to the root.
 */
function Combobox<Value>(props: ComboboxPrimitive.Root.Props<Value>) {
  return <ComboboxPrimitive.Root data-slot="combobox" {...props} />;
}

function ComboboxValue(props: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({
  className,
  size = "default",
  children,
  ...props
}: ComboboxPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm whitespace-nowrap text-foreground shadow-xs transition-[color,box-shadow] outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 dark:bg-transparent dark:hover:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        {children}
      </span>
      <ComboboxPrimitive.Icon
        render={<IconSelector />}
        className="text-muted-foreground"
      />
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxContent({
  className,
  children,
  sideOffset = 6,
  align = "start",
  side,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "sideOffset" | "align" | "side">) {
  const { level, className: surface } = useElevation(
    ELEVATION.menu,
    POPUP_SHADOW
  );
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        className={cn("isolate z-50 outline-none", HIDDEN_WITH_ANCHOR)}
        sideOffset={sideOffset}
        align={align}
        side={side}
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-surface={level}
          className={cn(
            // Match Select: grow with content, never shrink below the trigger.
            // A fixed `w-(--anchor-width)` clipped long labels (branch names).
            "z-50 flex max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) flex-col overflow-hidden rounded-md p-1 text-popover-foreground outline-none",
            surface,
            className
          )}
          {...props}
        >
          <SurfaceProvider value={level}>{children}</SurfaceProvider>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <div className="-mx-1 mb-1 flex items-center gap-2 border-b px-2.5 py-2">
      <IconSearch className="size-4 shrink-0 text-muted-foreground" />
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(
          "h-auto w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground",
          className
        )}
        {...props}
      />
    </div>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        // Native overflow (not ScrollArea) so intrinsic content width can't
        // blow past the popup and defeat `truncate` on long labels.
        "max-h-64 min-w-0 overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      {...props}
    />
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "px-2 py-6 text-center text-sm text-muted-foreground empty:hidden",
        className
      )}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <TruncatedRow
      render={
        <ComboboxPrimitive.Item
          data-slot="combobox-item"
          className={cn(
            "relative flex w-full min-w-0 cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-elevate data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
            className
          )}
          {...props}
        />
      }
    >
      {/* Truncate on the text node — `truncate` on a flex parent does nothing. */}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="pointer-events-none absolute right-2 flex items-center justify-center">
        <ComboboxPrimitive.ItemIndicator>
          <IconCheck className="size-4" />
        </ComboboxPrimitive.ItemIndicator>
      </span>
    </TruncatedRow>
  );
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
};
