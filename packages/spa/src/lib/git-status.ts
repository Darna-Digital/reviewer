import type { GitFileStatus } from "@reviewer/core/repo";

/** Per-status text colour, shared by every changed-file list. */
export const STATUS_COLOR: Record<GitFileStatus, string> = {
  added: "text-emerald-600 dark:text-emerald-400",
  modified: "text-amber-600 dark:text-amber-400",
  deleted: "text-destructive",
  renamed: "text-violet-600 dark:text-violet-400",
  untracked: "text-sky-600 dark:text-sky-400",
  ignored: "text-muted-foreground",
};
