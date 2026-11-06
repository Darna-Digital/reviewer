import type { ComponentProps } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "#/lib/cn";

/**
 * shadcn/ui's Drawer (vaul), with the site's neutral colours in place of
 * shadcn's theme tokens. Only the bottom sheet the site uses.
 */
function Drawer(props: ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal data-slot="drawer-portal">
      <DrawerPrimitive.Overlay
        className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60"
        data-slot="drawer-overlay"
      />
      <DrawerPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-[20px] bg-white ring-1 ring-black/[0.06] outline-none dark:bg-neutral-900 dark:ring-white/[0.08]",
          className
        )}
        data-slot="drawer-content"
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-black/10 dark:bg-white/15" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

function DrawerTitle({
  className,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn(
        "text-lg leading-7 font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-100",
        className
      )}
      data-slot="drawer-title"
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      className={cn(
        "text-base leading-6 text-neutral-600 dark:text-neutral-400",
        className
      )}
      data-slot="drawer-description"
      {...props}
    />
  );
}

export { Drawer, DrawerContent, DrawerDescription, DrawerTitle };
