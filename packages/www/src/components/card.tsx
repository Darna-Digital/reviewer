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
    <div
      className={cn(SURFACE, "flex flex-col gap-4 p-5 sm:gap-5 sm:p-6 lg:p-8")}
    >
      <span className={SYMBOL_TINT}>{icon}</span>
      <div className="flex flex-col gap-2">
        <p className="font-semibold tracking-[-0.01em] lg:text-xl">{title}</p>
        <p className="text-base leading-normal text-pretty text-neutral-600 sm:text-[15px] lg:text-[17px] dark:text-neutral-400">
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
      <div className="flex flex-col gap-3 p-5 sm:gap-4 sm:p-10 lg:gap-5 lg:p-12">
        <span className={SYMBOL_TINT}>{icon}</span>
        <h2 className="max-w-xl text-2xl leading-tight font-semibold tracking-[-0.02em] text-pretty sm:text-[30px] lg:max-w-3xl lg:text-5xl lg:leading-[1.15]">
          {title}
        </h2>
        <p className="max-w-2xl text-pretty text-neutral-600 lg:max-w-3xl lg:text-2xl lg:leading-[1.33] dark:text-neutral-400">
          {description}
        </p>
        {controls && <div className="mt-2">{controls}</div>}
      </div>
      <div className="px-2 pb-2 sm:px-10 sm:pb-10 lg:px-12 lg:pb-12">
        <div className="overflow-hidden rounded-xl ring-1 ring-black/10 dark:ring-white/10">
          {children}
        </div>
      </div>
    </div>
  );
}
