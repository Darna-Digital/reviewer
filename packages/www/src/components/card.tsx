import type { ReactNode } from "react";

import { cn } from "#/lib/cn";

export const SURFACE =
  "rounded-[20px] bg-black/[0.035] ring-1 ring-black/[0.04] dark:bg-white/[0.04] dark:ring-white/[0.06]";

const SYMBOL_TINT = "text-neutral-500 dark:text-neutral-400";

/** A screenshot's frame: a hairline and rounded corners. */
export const FRAME = "overflow-hidden rounded-xl";

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
  description: ReactNode;
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
        <div className={FRAME}>{children}</div>
      </div>
    </div>
  );
}

/**
 * A section's headline in two tones, as devin.ai sets them: the setup in
 * grey, the payoff in ink on the line below.
 */
export function SectionHeading({
  lead,
  children,
  className,
}: {
  lead: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-[30px] leading-[1.1] font-semibold tracking-[-0.015em] text-balance sm:text-[40px] lg:text-[52px]",
        className
      )}
    >
      <span className="block text-neutral-400 dark:text-neutral-500">
        {lead}
      </span>
      <span className="block">{children}</span>
    </h2>
  );
}

/** A page's opening: an eyebrow, the headline, a paragraph, then actions. */
export function PageHero({
  eyebrow,
  title,
  children,
  actions,
  note,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-start gap-6 pt-24 pb-10 sm:pt-36 sm:pb-14 lg:pt-44 lg:pb-16">
      {eyebrow}
      <h1 className="max-w-3xl text-[36px] leading-[1.05] font-bold tracking-[-0.02em] text-balance sm:text-[52px] lg:max-w-4xl lg:text-[72px]">
        {title}
      </h1>
      {children && (
        <p className="max-w-2xl text-lg leading-normal text-pretty text-neutral-600 sm:text-[21px] lg:text-2xl lg:leading-[1.4] dark:text-neutral-400">
          {children}
        </p>
      )}
      {actions && <div className="mt-2 w-full sm:w-auto">{actions}</div>}
      {note && (
        <p className="text-sm leading-relaxed text-pretty text-neutral-500 sm:text-[13px] lg:text-[15px]">
          {note}
        </p>
      )}
    </section>
  );
}
