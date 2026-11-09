import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { useRef } from "react";

import { Close } from "#/components/icons";
import { cn } from "#/lib/cn";

/**
 * shadcn/ui's Sheet on Base UI, with the site's neutral colours in place of
 * shadcn's theme tokens. Only the right-hand sheet the site uses, made for
 * phones: it slides fully in on the drawer's easing curve, fills the dynamic
 * viewport, keeps clear of the notch and home indicator, scrolls on its own
 * without moving the page, and puts its close button where the header's
 * hamburger sits.
 *
 * Opened with a finger or a mouse, the sheet takes focus itself, so no ring
 * lands on its first link; opened from the keyboard, its first link does.
 */
function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetContent({
  className,
  children,
  ...props
}: SheetPrimitive.Popup.Props) {
  const popup = useRef<HTMLDivElement>(null);

  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetPrimitive.Backdrop
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none dark:bg-black/60"
        data-slot="sheet-overlay"
      />
      <SheetPrimitive.Popup
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-dvh w-[85%] max-w-sm flex-col overflow-y-auto overscroll-contain border-l border-black/[0.06] bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:transition-none dark:border-white/[0.08] dark:bg-[#111113]",
          className
        )}
        data-slot="sheet-content"
        initialFocus={(type) => type === "keyboard" || popup.current}
        ref={popup}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="absolute top-[calc(env(safe-area-inset-top)+0.25rem)] right-1.5 inline-flex size-11 items-center justify-center rounded-full text-neutral-900 transition-colors hover:bg-black/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-300 dark:text-white dark:hover:bg-white/[0.08] dark:focus-visible:outline-neutral-600"
          data-slot="sheet-close"
        >
          <Close className="size-6" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      className={cn(
        "text-lg leading-7 font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-100",
        className
      )}
      data-slot="sheet-title"
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetTitle, SheetTrigger };
