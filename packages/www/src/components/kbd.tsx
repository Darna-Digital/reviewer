import type { ReactNode } from "react";

/** A key or shortcut, as a pill like the hero's agent chips. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.7em] items-center justify-center rounded-full bg-black/[0.04] px-2 py-px align-[0.08em] font-sans text-[0.88em] leading-snug font-medium text-neutral-800 ring-1 ring-black/[0.06] ring-inset dark:bg-white/[0.06] dark:text-neutral-200 dark:ring-white/[0.08]">
      {children}
    </kbd>
  );
}
