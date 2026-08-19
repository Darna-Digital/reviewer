import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/app-layout";

/**
 * The app's only layout route. Every page in the app is a child of this one,
 * so the frame, rail, header and dock it renders are mounted once and stay put
 * while pages come and go beneath them — see `AppLayout`.
 *
 * Cross-page view state lives in typed search params (no `useState` soup).
 */
export interface AppSearch {
  /** Open file overlay path. */
  file?: string;
  /** Selected file to scroll the diff to. */
  path?: string;
  /** One-based line in the open file to reveal — how a comment links to its code. */
  line?: number;
  /** Range-diff base/head (browse mode). */
  base?: string;
  head?: string;
  /**
   * The branch the local changes are read against — the whole task rather than
   * whatever is uncommitted. Absent means today's working-tree diff.
   */
  target?: string;
}

export const Route = createFileRoute("/_app")({
  validateSearch: (search: Record<string, unknown>): AppSearch => ({
    file: typeof search["file"] === "string" ? search["file"] : undefined,
    path: typeof search["path"] === "string" ? search["path"] : undefined,
    line: Number.isFinite(Number(search["line"]))
      ? Number(search["line"])
      : undefined,
    base: typeof search["base"] === "string" ? search["base"] : undefined,
    head: typeof search["head"] === "string" ? search["head"] : undefined,
    target: typeof search["target"] === "string" ? search["target"] : undefined,
  }),
  component: AppLayout,
});
