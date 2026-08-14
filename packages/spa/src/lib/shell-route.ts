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

export type ShellRoute =
  | { readonly kind: "code"; readonly mode: "commit" | "browse" | "review" }
  /** A workspace page that still sits over a repository: docs, tasks, threads, services. */
  | { readonly kind: "workspace" }
  | { readonly kind: "session" }
  | { readonly kind: "collaboration" }
  | { readonly kind: "settings" };

/** Pages under `/modes/code/` that are workspace pages rather than the diff. */
const CODE_WORKSPACE_PAGES = ["docs", "tasks", "threads", "local-dev"];

/**
 * `pathname` classified. `workMode` is the preference the collaboration/code
 * switch remembers, consulted only where the path itself does not say.
 */
export function shellRoute(
  pathname: string,
  workMode: "code" | "collaboration"
): ShellRoute {
  if (pathname.startsWith("/settings")) return { kind: "settings" };
  if (pathname.startsWith("/modes/agent-session")) return { kind: "session" };
  if (pathname.startsWith("/modes/collaboration")) {
    return { kind: "collaboration" };
  }

  if (pathname.startsWith("/modes/code/")) {
    const rest = pathname.slice("/modes/code/".length);
    const page = rest.split("/")[0] ?? "";
    if (CODE_WORKSPACE_PAGES.includes(page)) return { kind: "workspace" };
    if (page === "browse") return { kind: "code", mode: "browse" };
    if (page === "review") return { kind: "code", mode: "review" };
    return { kind: "code", mode: "commit" };
  }

  // Nothing in the path says: fall back to the remembered mode, which is what
  // the index route resolves against.
  return workMode === "collaboration"
    ? { kind: "collaboration" }
    : { kind: "code", mode: "commit" };
}

/** Whether the page beneath the layout is one of the git/code surfaces. */
export const showsGitChrome = (route: ShellRoute): boolean =>
  route.kind === "code" || route.kind === "workspace";
