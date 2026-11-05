/**
 * An inline pill around a product or agent name, like the hero's agent chips.
 *
 * It is a plain inline span, so its padding doesn't change the line box and
 * its label sits on the surrounding text's baseline. Inter's content box is
 * centred on its cap height (0.36em above the baseline), so the pill is
 * centred on the capitals too. Everything is in em, so it scales with the
 * text it sits in.
 */
export const CHIP =
  "whitespace-nowrap rounded-full bg-black/[0.04] px-[0.45em] py-[0.08em] font-medium text-neutral-800 ring-1 ring-black/[0.06] ring-inset dark:bg-white/[0.06] dark:text-neutral-200 dark:ring-white/[0.08]";

/** A chip's icon: 0.9em, centred on the cap height, before the label. */
export const CHIP_ICON = "mr-[0.3em] inline-block size-[0.9em] align-[-0.09em]";
