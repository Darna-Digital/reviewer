import type { ReactNode } from "react";

import { cn } from "#/lib/cn";

const SURFACE =
  "rounded-[20px] bg-black/[0.035] ring-1 ring-black/[0.04] dark:bg-white/[0.04] dark:ring-white/[0.06]";

const SYMBOL_TINT = "text-neutral-500 dark:text-neutral-400";

/** A symbol over a single sentence — the row directly under the hero. */
export function PointCard({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn(SURFACE, "flex flex-col gap-8 p-6")}>
      <span className={SYMBOL_TINT}>{icon}</span>
      <p className="text-[19px] leading-snug font-semibold tracking-[-0.01em] text-pretty">
        {children}
      </p>
    </div>
  );
}

/** A symbol, a headline and its supporting paragraph. */
export function NoteCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(SURFACE, "flex flex-col gap-5 p-6")}>
      <span className={SYMBOL_TINT}>{icon}</span>
      <div className="flex flex-col gap-2">
        <p className="font-semibold tracking-[-0.01em]">{title}</p>
        <p className="text-[15px] leading-normal text-pretty text-neutral-600 dark:text-neutral-400">
          {children}
        </p>
      </div>
    </div>
  );
}

/**
 * The full-width card: the claim, the paragraph behind it, and the interface
 * it is about, bleeding off the bottom edge the way an app window would.
 */
export function ShowcaseCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(SURFACE, "overflow-hidden")}>
      <div className="flex flex-col gap-4 p-8 sm:p-10">
        <span className={SYMBOL_TINT}>{icon}</span>
        <h2 className="max-w-xl text-[26px] leading-tight font-semibold tracking-[-0.02em] text-pretty sm:text-[30px]">
          {title}
        </h2>
        <p className="max-w-2xl text-pretty text-neutral-600 dark:text-neutral-400">
          {description}
        </p>
      </div>
      <div className="h-[280px] overflow-hidden px-8 sm:h-[360px] sm:px-10">
        <div className="overflow-hidden rounded-t-xl ring-1 ring-black/10 dark:ring-white/10">
          {children}
        </div>
      </div>
    </div>
  );
}
