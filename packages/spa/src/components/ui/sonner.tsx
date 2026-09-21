import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";
import { buttonVariants } from "@/components/ui/button";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";
import { ELEVATION, useElevation } from "@/lib/surface-context";
import { useUiPrefs } from "@/lib/ui-prefs";

/* Sonner injects its stylesheet into <head> at runtime, outside Tailwind's
   cascade layers, so those rules outrank every utility class however specific.
   `unstyled` opts out of the styling half of it and keeps the half worth having
   — absolute positioning, stacking transforms, swipe gestures. The `!`
   modifiers below cover the few rules that survive `unstyled`, all of them the
   dark-theme ones sonner scopes to the toaster rather than to `[data-styled]`. */

/* Sonner's 4s is about as long as "Saved" needs and well short of what a
   six-line push rejection does. The clamps below cap the tallest toast, so a
   single duration can cover both ends. */
const READ_TIME_MS = 6000;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useUiPrefs();
  // A toast never opens on top of another popup, so unlike a menu it can take
  // the shadow of its own rung rather than a fixed popup weight.
  const { className: surface } = useElevation(ELEVATION.dialog);

  return (
    <Sonner
      theme={theme}
      closeButton
      duration={READ_TIME_MS}
      gap={10}
      offset={16}
      className="font-sans!"
      style={{ "--width": "23rem" } as React.CSSProperties}
      icons={{
        success: <IconCircleCheck className="size-4 text-success" />,
        info: <IconInfoCircle className="size-4 text-muted-foreground" />,
        warning: <IconAlertTriangle className="size-4 text-warning" />,
        error: <IconAlertOctagon className="size-4 text-destructive" />,
        loading: <Orb size={14} />,
        close: <IconX className="size-4" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: cn(
            "relative flex w-full items-start gap-2.5 overflow-hidden rounded-lg p-3 text-popover-foreground",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            // Toasts stacked behind the front one drop their content, so the
            // sliver peeking out below reads as a card edge rather than as
            // clipped text. Sonner does this itself when it owns the styling.
            "data-[expanded=false]:data-[front=false]:*:opacity-0",
            surface
          ),
          // A plain toast renders this box empty; `h-5` centres the glyph on
          // the first line of the title rather than on the whole text block.
          icon: "relative flex h-5 w-4 shrink-0 items-center justify-center empty:hidden",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          // `wrap-anywhere` is what keeps an unbroken token — a commit sha, a
          // path, a URL — inside the toast instead of pushing it wider.
          title: "line-clamp-3 type-ui wrap-anywhere",
          description:
            "line-clamp-6 type-body wrap-anywhere text-muted-foreground!",
          actionButton: buttonVariants({
            variant: "outline",
            size: "xs",
            className: "self-start",
          }),
          cancelButton: buttonVariants({
            variant: "ghost-muted",
            size: "xs",
            className: "self-start",
          }),
          closeButton: buttonVariants({
            variant: "ghost",
            size: "icon-xs",
            className:
              "order-last self-start bg-transparent! text-muted-foreground! hover:bg-hover! hover:text-foreground!",
          }),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
