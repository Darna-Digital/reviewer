/**
 * The two filters the sessions list carries, as the query that fetches it.
 *
 * Sessions are stored centrally, so the list holds every repository's
 * conversations at once. Recency was enough while it only ever held one
 * repository's; where a session was had — its workspace or its repository — is
 * the other axis that got interesting the moment they arrived together.
 *
 * Both used to be applied to the loaded list. They are now part of what is
 * asked for, because the list arrives a page at a time: filtering in the client
 * would search the pages scrolled to so far and present that as the whole
 * answer — a session further down would read as one that does not exist. So
 * these turn a stored filter into the query, and the database does the
 * narrowing over all of them. See `useChatPages`.
 */
import { dateCutoff, type DateFilter } from "@/lib/date-filter";
import type { ChatListFilters } from "@/lib/queries";
import type { ChatPlaces } from "@reviewer/core/chats";

/**
 * Where the sessions were had: everywhere, the sessions started in one saved
 * workspace, or the ones whose agent ran in one repository — alone or inside
 * a workspace.
 */
export type PlaceFilter =
  | { readonly kind: "all" }
  | { readonly kind: "workspace"; readonly id: string }
  | { readonly kind: "repo"; readonly path: string };
export const ALL_PLACES: PlaceFilter = { kind: "all" };

export const samePlace = (a: PlaceFilter, b: PlaceFilter): boolean => {
  switch (a.kind) {
    case "all":
      return b.kind === "all";
    case "workspace":
      return b.kind === "workspace" && b.id === a.id;
    case "repo":
      return b.kind === "repo" && b.path === a.path;
  }
};

/** What the list remembers between visits. */
export interface ChatFilters {
  readonly place: PlaceFilter;
  readonly date: DateFilter;
}

export const NO_FILTERS: ChatFilters = {
  place: ALL_PLACES,
  date: "all",
};

/**
 * The window's cutoff is rounded down to the minute before it becomes part of
 * what is asked for. "Past 7 days" is seven days before *now*, which is a
 * different instant every millisecond — and since the query is keyed on what it
 * asks for, an unrounded cutoff would make every visit to the list a cache miss
 * and leave a spent entry behind each time. A minute is far finer than any of
 * these windows and answers the same question.
 */
const CUTOFF_PRECISION_MS = 60_000;

/** The stored filters as what the list asks the server for. */
export const chatListFilters = (
  place: PlaceFilter,
  date: DateFilter
): ChatListFilters => {
  const cutoff = dateCutoff(date);
  return {
    search: "",
    workspace: place.kind === "workspace" ? place.id : null,
    repo: place.kind === "repo" ? place.path : null,
    since:
      cutoff === 0
        ? null
        : new Date(
            Math.floor(cutoff / CUTOFF_PRECISION_MS) * CUTOFF_PRECISION_MS
          ).toISOString(),
  };
};

/**
 * The place filter to actually apply. A stored filter outlives the place it
 * names — a workspace can be deleted, a repository's sessions emptied — and a
 * filter pointing at nothing would leave the list permanently blank. It steps
 * aside instead, but only once there are places to check it against: mid-load
 * everything is absent, and that is not the same as gone.
 */
export const resolvePlaceFilter = (
  places: ChatPlaces,
  place: PlaceFilter
): PlaceFilter => {
  if (places.workspaces.length === 0 && places.repos.length === 0) {
    return place;
  }
  switch (place.kind) {
    case "all":
      return place;
    case "workspace":
      return places.workspaces.some((option) => option.id === place.id)
        ? place
        : ALL_PLACES;
    case "repo":
      return places.repos.some((option) => option.path === place.path)
        ? place
        : ALL_PLACES;
  }
};
