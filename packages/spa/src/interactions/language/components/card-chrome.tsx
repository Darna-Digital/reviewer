/**
 * The shared furniture of the cards a token opens.
 *
 * Hover documentation, a usage list and a choice of declarations are three
 * answers to the same gesture, so they are built from the same parts: a heading
 * that names the symbol, a chip that says what kind of thing it is, a rule, and
 * a footer for links out. Keeping the parts here is what stops the three from
 * drifting into three different cards — which is what they were, each with its
 * own idea of how big a heading is and how muted a secondary label gets.
 *
 * The palette is deliberately thin. The symbol name is the one thing set in the
 * accent colour, because it is the one thing the user is looking for; every
 * other label is muted, and colour beyond that is reserved for chips that carry
 * meaning a word alone would not (a write is not a read).
 */
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/**
 * Chip colours. `neutral` is the default and the common case — a kind, a count.
 * The rest mark a distinction worth seeing before it is read.
 */
const CHIP_TONE = {
  neutral: "text-muted-foreground",
  accent: "text-brand-700 dark:text-brand-300",
  attention: "text-amber-700 dark:text-amber-400",
} as const;

export type ChipTone = keyof typeof CHIP_TONE;

export function CardChip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      data-slot="card-chip"
      className={cn(
        // `bg-elevate-strong` is substrate-relative, so the chip keeps the same
        // contrast whether the card opened over the code or over another popup.
        "shrink-0 rounded bg-elevate-strong px-1.5 py-0.5 font-mono text-[10px] leading-tight",
        CHIP_TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function CardHeading({
  icon: Icon,
  name,
  kind,
  meta,
}: {
  /** What kind of answer this is — a magnifier for usages, an arrow for a jump. */
  icon?: ComponentType<{ className?: string }>;
  /** The symbol the card is about, set in the code font. */
  name: string;
  /** What the symbol is (`method`, `const`), when the server says. */
  kind?: string;
  /** A count or note, pushed to the right. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {Icon !== undefined && (
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span
        data-slot="card-symbol"
        className="min-w-0 truncate font-mono text-[13px] font-semibold text-brand-700 dark:text-brand-300"
      >
        {name}
      </span>
      {kind !== undefined && kind.length > 0 && <CardChip>{kind}</CardChip>}
      {meta !== undefined && (
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
          {meta}
        </span>
      )}
    </div>
  );
}

/**
 * The line between a card's heading and its list. Full-bleed, so the heading
 * reads as a bar over the rows rather than as the first of them.
 */
export function CardRule() {
  return <div className="h-px shrink-0 bg-border" />;
}

/** A documentation link the language server appended to a hover. */
export function CardLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground no-underline hover:text-foreground hover:underline"
    >
      <Icon className="size-3 shrink-0" />
      {children}
    </a>
  );
}
