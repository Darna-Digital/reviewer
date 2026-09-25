import type { ReactNode } from "react";

import { cn } from "#/lib/cn";

const SURFACE =
  "rounded-[20px] bg-black/[0.035] ring-1 ring-black/[0.04] dark:bg-white/[0.04] dark:ring-white/[0.06]";

const SYMBOL_TINT = "text-neutral-500 dark:text-neutral-400";

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
 * The full-width card: the claim, the paragraph behind it, and the screenshot
 * of the interface it is about. Screenshots carry their own desktop around
 * the window, so they are shown whole rather than cropped.
 */
export function ShowcaseCard({
  icon,
  title,
  description,
  controls,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  /** Sits under the paragraph, for switching what the screenshot shows. */
  controls?: ReactNode;
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
        {controls && <div className="mt-2">{controls}</div>}
      </div>
      <div className="px-8 pb-8 sm:px-10 sm:pb-10">
        <div className="overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10">
          {children}
        </div>
      </div>
    </div>
  );
}
