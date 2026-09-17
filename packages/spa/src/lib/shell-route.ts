/**
 * What the shell is showing, worked out from the URL.
 *
 * The app has one layout, and the layout has to know which of a few shapes the
 * current page is: a code surface with a repository behind it, one agent
 * session, the collaboration prototype, or settings. That used to be encoded in
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
  /** A workspace page that still sits over a repository: the reviews list. */
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
      /**
       * The conversation lifted into a tab of its own, with no list beside it.
       *
       * Everything in the sessions rail acts on that list — mint one, find one,
       * narrow which of them are shown — so beside a conversation that has the
       * window to itself the column is three buttons for a surface that is not
       * there. The window bar carries the ones still worth having here: ✛ mints
       * a session, ⌘K finds anything, and the trail leads back to the list.
       *
       * Not something the path can say: which tab is holding the window is the
       * strip's business, and the same URL is the list's conversation on the
       * Sessions tab and a page of its own on a session tab.
       */
      readonly solo: boolean;
    }
  /**
   * The collaboration prototype, kept whole under `/modes/experimentation` as
   * the reference the redesign was measured against. It wears the chrome it
   * always wore — its own sidebar, its workspace picker, its strip of open
   * surfaces — which is the point of keeping it: the two shapes can be put
   * side by side without either being bent towards the other.
   */
  | { readonly kind: "experimentation" }
  | { readonly kind: "settings" };

/** The collaboration prototype, which is not one of the app's own surfaces. */
const EXPERIMENTATION_PREFIX = "/modes/experimentation";

/** Pages under `/modes/code/` that are workspace pages rather than the diff. */
const CODE_WORKSPACE_PAGES = ["reviews"];

/**
 * What the diff view is pointed at, as the URL says it.
 *
 * One view reads both, so they are one route with two shapes rather than two
 * routes: `/review` is the changes in front of you, and `/review/pull/12` is
 * somebody else's, read in the same pane.
 */
export type ReviewSource =
  | { readonly kind: "local" }
  | { readonly kind: "pull"; readonly number: number };

/** The diff view. */
export const REVIEW_HREF = "/modes/code/review";
/** Everything waiting to be read, listed. */
export const REVIEWS_HREF = "/modes/code/reviews";

export const reviewHref = (source: ReviewSource): string =>
  source.kind === "local"
    ? REVIEW_HREF
    : `${REVIEW_HREF}/pull/${source.number}`;

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
  if (head === "pull" && rest[0] !== undefined && /^\d+$/.test(rest[0])) {
    return { kind: "pull", number: Number(rest[0]) };
  }
  return null;
};

/**
 * The project browser: the tree is every file in the repository and the centre
 * pane is the file viewer.
 *
 * Where the window goes back to when a dock page is put down and nowhere else
 * has been asked for — and where a jump to code from outside the page lands,
 * rather than on whichever page the window happened to be on. Commit mode's
 * tree is the changed files and its pane is the worktree diff; a review's are
 * the pull request's. A file an analysis or a usage points at belongs to
 * neither, so opening one there put it on screen inside a context that
 * disagreed with it — a file absent from the tree beside it, under a trail
 * reading "Local changes".
 */
export const BROWSE_HREF = "/modes/code/browse";

/**
 * Whether the window is already in the browser, in which case a jump to a file
 * only swaps it over: a commit or a range being read under `/browse` is context
 * the file sits inside rather than context it contradicts, so following a
 * result there should not throw it away.
 */
export const isBrowsingCode = (pathname: string): boolean =>
  pathname === BROWSE_HREF || pathname.startsWith(`${BROWSE_HREF}/`);

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
  find: {
    tab: "find",
    href: "/modes/code/find",
    title: "Find usages",
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
 * `pathname` classified. `startingNew` is the sessions index's `?new`, which the
 * path cannot carry; `soloSession` says the window is on a session's own tab,
 * which it cannot carry either.
 */
export function shellRoute(
  pathname: string,
  startingNew = false,
  soloSession = false
): ShellRoute {
  if (pathname.startsWith("/settings")) return { kind: "settings" };
  if (pathname.startsWith("/modes/agent-session")) {
    // The bare path is the list, which wears the shell like any other page; the
    // composer is the one thing under here that asks for the window to itself,
    // and it says so in the search rather than in the path.
    return { kind: "session", composing: startingNew, solo: soloSession };
  }
  if (pathname.startsWith(EXPERIMENTATION_PREFIX)) {
    return { kind: "experimentation" };
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

  // Nothing in the path says: the diff view, which is what the index route
  // resolves against.
  return { kind: "code", mode: "review" };
}

/**
 * Whether the window is on one of the app's own surfaces rather than on the
 * collaboration prototype.
 *
 * The prototype wears its own chrome and carries its own search, so the shell's
 * — ⌘K, ⌘B, the window menu's panes — stays out of its way. Everything else in
 * the app is code work and gets all of it.
 */
export const isCodeSurface = (pathname: string): boolean =>
  !pathname.startsWith(EXPERIMENTATION_PREFIX);

/** Whether the page beneath the layout is one of the git/code surfaces. */
export const showsGitChrome = (route: ShellRoute): boolean =>
  route.kind === "code" || route.kind === "workspace" || route.kind === "dock";
