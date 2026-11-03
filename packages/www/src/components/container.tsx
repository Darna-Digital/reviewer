import type { ReactNode } from "react";

import { cn } from "#/lib/cn";

/**
 * Hero screenshots run wider than the text column, up to 1440px, as they did
 * before the redesign. Pass it as the Container's className.
 */
export const HERO_WIDTH = "max-w-[1440px] lg:max-w-[1440px]";

/** One column, the width of the screenshots, centred for the whole page. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1008px] px-4 sm:px-6 lg:max-w-[1248px]",
        className
      )}
    >
      {children}
    </div>
  );
}
