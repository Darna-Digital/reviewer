/**
 * What the shell is showing, worked out from the URL.
 *
 * The app has one layout, and the layout has to know which of a few shapes the
 * current page is: a code surface with a repository behind it, one agent
 * session, the collaboration workspace, or settings. That used to be encoded in
 * *which layout route matched* — two pathless layouts, each with its own frame,
 * header and dock — so moving between them threw one whole shell away and built
 * the other. Reading it from the path instead lets one shell stay put and
 * simply render itself differently.
 *
 * Pure, so the classification is testable without a router.
 */
import type { BottomTab } from "@/lib/ui-prefs";

export type ShellRoute =
  | { readonly kind: "code"; readonly mode: "browse" | "review" }
  /** A workspace page that still sits over a repository: docs, tasks. */
  | { readonly kind: "workspace" }
  /**
   * One of the dock's surfaces with the window to itself rather than a drawer's
   * worth of it. The layout gives the canvas to the dock and the page beneath is
   * put away — see `AppLayout`.
   */
  | { readonly kind: "dock"; readonly tab: BottomTab }
  | {
      readonly kind: "session";
      /**
       * The blank composer rather than the list or a conversation. Everything
       * the shell puts around a session is about one that exists: a rail for
       * moving between them, a trail naming the one you are in. Before there is
       * a session, all of it is chrome around an empty page, so the composer
       * gets the window to itself.
       */
      readonly composing: boolean;
    }
  | { readonly kind: "collaboration" }
  | { readonly kind: "settings" };

/** Pages under `/modes/code/` that are workspace pages rather than the diff. */
const CODE_WORKSPACE_PAGES = ["docs", "tasks", "reviews"];

/**
 * What the diff view is pointed at, as the URL says it.
 *
 * One view reads all three, so they are one route with three shapes rather than
 * three routes: `/review` is the changes in front of you, and the other two name
 * whose work it is instead. A branch holds slashes, so the worktree's is the
 * rest of the path rather than one segment of it.
 */
export type ReviewSource =
  | { readonly kind: "local" }
  | { readonly kind: "worktree"; readonly branch: string }
  | { readonly kind: "pull"; readonly number: number };

/** The diff view. */
export const REVIEW_HREF = "/modes/code/review";
/** Everything waiting to be read, listed. */
export const REVIEWS_HREF = "/modes/code/reviews";

export const reviewHref = (source: ReviewSource): string => {
  if (source.kind === "local") return REVIEW_HREF;
  return source.kind === "pull"
    ? `${REVIEW_HREF}/pull/${source.number}`
    : `${REVIEW_HREF}/worktree/${source.branch}`;
};

const onReviewPath = (pathname: string): boolean =>
  pathname === REVIEW_HREF || pathname.startsWith(`${REVIEW_HREF}/`);

/** Null when the path is not the diff view at all — `/reviews` included. */
export const reviewSourceOf = (pathname: string): ReviewSource | null => {
  if (!onReviewPath(pathname)) return null;
  const [head, ...rest] = pathname
    .slice(REVIEW_HREF.length)
    .replace(/^\//, "")
    .split("/")
    .filter((segment) => segment.length > 0);
  if (head === undefined) return { kind: "local" };
  if (head === "worktree" && rest.length > 0) {
    return { kind: "worktree", branch: rest.join("/") };
  }
  if (head === "pull" && rest[0] !== undefined && /^\d+$/.test(rest[0])) {
    return { kind: "pull", number: Number(rest[0]) };
  }
  return null;
};

/** Where the window goes back to when a dock page is put down and nowhere else
 * has been asked for. */
export const BROWSE_HREF = "/modes/code/browse";

/**
 * A dock surface as a page of its own: where it lives, and what it is called
 * wherever it is named — the launchpad's card, the window bar's tab, and the
 * trail along the foot of the page itself.
 */
export interface DockPage {
  readonly tab: BottomTab;
  readonly href: string;
  readonly title: string;
}

/**
 * The four of them, keyed by the surface they show.
 *
 * Held here rather than beside the drawer because the classification above is
 * the same knowledge read the other way round: a location is a dock page
 * exactly when it is one of these.
 */
const DOCK_PAGES: Record<BottomTab, DockPage> = {
  branches: {
    tab: "branches",
    href: "/modes/code/branches",
    title: "Branches",
  },
  history: {
    tab: "history",
    href: "/modes/code/history",
    title: "Branch history",
  },
  services: {
    tab: "services",
    href: "/modes/code/local-dev",
    title: "Services",
  },
  threads: {
    tab: "threads",
    href: "/modes/code/threads",
    title: "Terminals",
  },
};

/** Every dock page, in the order the drawer's strip holds their surfaces. */
export const dockPages: ReadonlyArray<DockPage> = Object.values(DOCK_PAGES);

export const dockPage = (tab: BottomTab): DockPage => DOCK_PAGES[tab];

/**
 * `pathname` classified. `workMode` is the preference the collaboration/code
 * switch remembers, consulted only where the path itself does not say.
 * `startingNew` is the sessions index's `?new`, which the path cannot carry.
 */
export function shellRoute(
  pathname: string,
  workMode: "code" | "collaboration",
  startingNew = false
): ShellRoute {
  if (pathname.startsWith("/settings")) return { kind: "settings" };
  if (pathname.startsWith("/modes/agent-session")) {
    // The bare path is the list, which wears the shell like any other page; the
    // composer is the one thing under here that asks for the window to itself,
    // and it says so in the search rather than in the path.
    return { kind: "session", composing: startingNew };
  }
  if (pathname.startsWith("/modes/collaboration")) {
    return { kind: "collaboration" };
  }

  if (pathname.startsWith("/modes/code/")) {
    const rest = pathname.slice("/modes/code/".length);
    const page = rest.split("/")[0] ?? "";
    const dock = dockPages.find(
      (surface) => surface.href === `/modes/code/${page}`
    );
    if (dock !== undefined) return { kind: "dock", tab: dock.tab };
    if (CODE_WORKSPACE_PAGES.includes(page)) return { kind: "workspace" };
    if (page === "browse") return { kind: "code", mode: "browse" };
    return { kind: "code", mode: "review" };
  }

  // Nothing in the path says: fall back to the remembered mode, which is what
  // the index route resolves against.
  return workMode === "collaboration"
    ? { kind: "collaboration" }
    : { kind: "code", mode: "review" };
}

/** Whether the page beneath the layout is one of the git/code surfaces. */
export const showsGitChrome = (route: ShellRoute): boolean =>
  route.kind === "code" || route.kind === "workspace" || route.kind === "dock";
