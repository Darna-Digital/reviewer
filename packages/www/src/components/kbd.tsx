import type { ReactNode } from "react";

/**
 * A key or shortcut, as a pill like the hero's agent chips. The text box is
 * trimmed to the glyphs, to cap height or, for a lowercase key like s, to
 * x-height, so the pill centres what you see rather than the line box.
 */
export function Kbd({ children }: { children: ReactNode }) {
  const lowercase = typeof children === "string" && /^[a-z]$/.test(children);
  return (
    <kbd className="inline-flex h-[1.6em] min-w-[1.7em] items-center justify-center rounded-full bg-black/[0.04] px-2 align-middle font-sans text-[0.88em] leading-snug font-medium text-neutral-800 ring-1 ring-black/[0.06] ring-inset dark:bg-white/[0.06] dark:text-neutral-200 dark:ring-white/[0.08]">
      <span
        className={
          lowercase
            ? "[text-box:trim-both_ex_alphabetic]"
            : "[text-box:trim-both_cap_alphabetic]"
        }
      >
        {children}
      </span>
    </kbd>
  );
}
