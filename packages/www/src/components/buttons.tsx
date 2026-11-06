import { Link } from "@tanstack/react-router";

import { Apple } from "#/components/icons";
import { cn } from "#/lib/cn";

export const PRIMARY_BUTTON =
  "inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-neutral-900 px-6 text-base font-semibold text-white transition-colors hover:bg-neutral-700 lg:h-13 lg:px-7 lg:text-[17px] dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";

export const SECONDARY_BUTTON =
  "inline-flex h-12 items-center justify-center gap-2.5 rounded-full px-6 text-base font-semibold text-neutral-900 ring-1 ring-black/15 transition-colors ring-inset hover:bg-black/[0.04] lg:h-13 lg:px-7 lg:text-[17px] dark:text-white dark:ring-white/20 dark:hover:bg-white/[0.06]";

export function DownloadButton({ className }: { className?: string }) {
  return (
    <Link
      className={cn(PRIMARY_BUTTON, className)}
      search={{ app: "mac" }}
      to="/download"
    >
      <Apple className="size-5" />
      Download for Mac
    </Link>
  );
}

/** The download page, where you pick an app, and the about page. */
export function GetReviewerButtons({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row", className)}>
      <Link className={PRIMARY_BUTTON} to="/download">
        Download
      </Link>
      <Link className={SECONDARY_BUTTON} to="/about">
        About
      </Link>
    </div>
  );
}
