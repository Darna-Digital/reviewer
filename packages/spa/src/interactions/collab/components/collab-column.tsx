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
 */
import type { ReactNode } from "react";
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
    <div className={cn("mx-auto w-full px-6 pt-8 pb-28", WIDTH[width])}>
      {children}
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
