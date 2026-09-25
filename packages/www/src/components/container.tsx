import type { ReactNode } from "react";

import { cn } from "#/lib/cn";

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
      className={cn("mx-auto w-full max-w-[1008px] px-4 sm:px-6", className)}
    >
      {children}
    </div>
  );
}
