/**
 * The centred column every collaboration surface is drawn in, and the pieces
 * that make up a page inside it.
 *
 * Basecamp's page is a column standing on a wide, quiet ground, and the whole
 * of that idea is here so no page has to restate it: one width for reading down
 * (a project, a list, a note) and one for reading across (the board). The
 * heading, the section label and the panel are the three things every one of
 * those pages is built from, kept here for the same reason — a page should be
 * able to say what it holds without also deciding what a section looks like.
 *
 * The column is a sheet, not a transparent box. The mode drops the full-pane
 * canvas so the app's ground runs edge to edge, but prose still wants a page
 * under it — so the page is made exactly as wide as the column, with the ground
 * left showing around it. That margin is where the frame is seen, which on the
 * native shell is the desktop. See `.collab-sheet`.
 *
 * It stands at least the height of the window even when it holds a paragraph:
 * a sheet that stopped where its content did would read as a card dropped on
 * the page rather than as the page itself.
 */
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CollabWidth } from "../interfaces/collab.interfaces";

const WIDTH: Record<CollabWidth, string> = {
  // Wide enough for four board columns and their gaps; the board scrolls
  // sideways past that rather than shrinking its cards to fit.
  wide: "max-w-[80rem]",
  narrow: "max-w-3xl",
};

export function CollabColumn({
  width,
  children,
}: {
  readonly width: CollabWidth;
  readonly children: ReactNode;
}) {
  return (
    // The ground, and the gap that lets it be seen. A flex row with a definite
    // height, so the sheet fills it by being a flex child rather than by asking
    // for a percentage of it — a scroller puts a wrapper of its own between the
    // two, and a percentage height resolved against that auto-sized box is no
    // height at all.
    <div className="flex min-h-0 flex-1 justify-center p-3">
      <div
        className={cn(
          "collab-sheet flex min-h-0 w-full flex-col overflow-hidden rounded-2xl",
          WIDTH[width]
        )}
      >
        {/* The page scrolls, not the window: the scrollbar belongs inside the
            sheet's own edges, and the sheet's corners stay round while its
            content runs past them. */}
        <ScrollArea className="min-h-0 flex-1">
          {/* `px-6` rather than a roomier inset because the board bleeds its
              sideways scroller back out by exactly that much — see `BoardPage`.
              The foot clears the hovering bar, which stands over the sheet
              rather than after it. */}
          <div className="px-6 pt-8 pb-24">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}

/**
 * A page's own name. Heavy and large, the way Basecamp titles a page — this is
 * the one place in byconvo where type is allowed to be loud, because it is
 * standing alone at the top of a column rather than competing in a bar.
 */
export function CollabTitle({
  children,
  eyebrow,
  actions,
}: {
  readonly children: ReactNode;
  /** The trail above the title — the project a surface belongs to. */
  readonly eyebrow?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow !== undefined && (
          <div className="mb-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-balance">
          {children}
        </h1>
      </div>
      {actions !== undefined && (
        <div className="flex shrink-0 items-center gap-1.5 pt-1">{actions}</div>
      )}
    </header>
  );
}

/**
 * A section's label. Warm rather than grey, which is Basecamp's one piece of
 * colour on an otherwise quiet page: it marks where one tool ends and the next
 * begins without a rule having to be drawn across the column.
 */
export function CollabSectionHeading({
  children,
  action,
}: {
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.9375rem] font-semibold text-collab-accent">
        {children}
      </h2>
      {action}
    </div>
  );
}

/** The bordered sheet a section's contents stand on. */
export function CollabPanel({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-2 shadow-surface-2",
        className
      )}
    >
      {children}
    </div>
  );
}

/** What a panel says when it is empty, in the voice the rest of the app uses. */
export function CollabEmpty({ children }: { readonly children: ReactNode }) {
  return (
    <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
      {children}
    </p>
  );
}
