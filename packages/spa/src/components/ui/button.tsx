import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* Buttons come in one loud face and several quiet ones, and the split is
   deliberately lopsided: `default` is the single filled action a view is
   allowed, everything else recedes. The brand never fills a button — it lives
   in the focus ring and in links, so the eye reads "focused" and "clickable
   text" as ours and "the primary action here" as simply the darkest thing on
   screen. Tabular numerals keep counts from reflowing as they tick.

   `destructive` is the one exception, and it earns it: it appears only as the
   go-ahead in a dialog that has stopped you to ask, where it *is* that view's
   single filled action, and where the whole point is that it must not be
   mistaken for the Cancel sitting next to it. Red type on the same quiet face
   as Cancel was that mistake — it read as a broken label rather than as the
   dangerous button.

   Neither focus nor invalid is written here. Both are blooms in the shadow
   stack rather than outlines, so they have to compose with whatever elevation
   the face already carries — see `--glow-focus`, `--glow-invalid` and the
   `[data-slot="button"]` rules in `styles.css`. All that is left on this side
   is `outline-none`, which keeps the browser from drawing its own ring over
   the top. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md bg-clip-padding whitespace-nowrap tabular-nums transition-[background,box-shadow,color] outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary face-contrast text-primary-foreground disabled:opacity-40",
        outline:
          "bg-button-neutral face-raised text-foreground aria-expanded:bg-pressed",
        secondary:
          "bg-button-neutral face-raised text-foreground aria-expanded:bg-pressed",
        ghost:
          "face-quiet text-foreground aria-expanded:bg-pressed aria-expanded:text-foreground",
        "ghost-muted":
          "face-quiet text-muted-foreground aria-expanded:bg-pressed aria-expanded:text-foreground [&_svg]:text-muted-foreground aria-expanded:[&_svg]:text-foreground",
        destructive:
          "bg-destructive-fill face-danger text-destructive-on-fill disabled:opacity-40",
        link: "text-link underline-offset-4 hover:underline",
      },
      /* Each size carries its own whole type step, so a button never has to
         merge a size class against a weight class from somewhere else. */
      size: {
        default:
          "h-8 gap-1.5 px-3 type-ui has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-sm px-2 type-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 type-ui has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-9 gap-1.5 px-4 type-ui has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        /* The top-bar pickers — project, organisation, branch. They read as
           labels you press rather than as controls, so they keep the roomier
           14px/500 they have always had instead of joining the 13px/530 chrome.
           Plain Tailwind steps here on purpose: both are ones tailwind-merge
           knows, so a caller can still override them. */
        chip: "h-7 gap-1 px-3 text-sm font-medium has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8 type-ui",
        "icon-xs":
          "size-6 rounded-sm type-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 type-ui",
        "icon-lg": "size-9 type-ui",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
