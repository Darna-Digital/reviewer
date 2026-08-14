/**
 * The two filters the sessions list carries, as the query that fetches it.
 *
 * Sessions are stored centrally, so the list holds every project's
 * conversations at once. Recency was enough while it only ever held one
 * project's; the project itself is the other axis that got interesting the
 * moment they arrived together.
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
import type { ChatProjectTally } from "@byconvo/core/chats";

/** `all` is the unfiltered case; anything else is a project's absolute path. */
export type ProjectFilter = string;
export const ALL_PROJECTS: ProjectFilter = "all";

/** What the list remembers between visits. */
export interface ChatFilters {
  readonly project: ProjectFilter;
  readonly date: DateFilter;
}

export const NO_FILTERS: ChatFilters = {
  project: ALL_PROJECTS,
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
  project: ProjectFilter,
  date: DateFilter
): ChatListFilters => {
  const cutoff = dateCutoff(date);
  return {
    search: "",
    project: project === ALL_PROJECTS ? null : project,
    since:
      cutoff === 0
        ? null
        : new Date(
            Math.floor(cutoff / CUTOFF_PRECISION_MS) * CUTOFF_PRECISION_MS
          ).toISOString(),
  };
};

/**
 * The project filter to actually apply. A stored filter outlives the project it
 * names — a session list it once narrowed can be emptied, and a filter pointing
 * at nothing would leave the list permanently blank. It steps aside instead,
 * but only once there are projects to check it against: mid-load everything is
 * absent, and that is not the same as gone.
 */
export const resolveProjectFilter = (
  projects: ReadonlyArray<ChatProjectTally>,
  project: ProjectFilter
): ProjectFilter =>
  project === ALL_PROJECTS ||
  projects.length === 0 ||
  projects.some((option) => option.path === project)
    ? project
    : ALL_PROJECTS;
