/**
 * The two filters the sessions list carries.
 *
 * Sessions are stored centrally, so the list holds every project's
 * conversations at once. Recency was enough while it only ever held one
 * project's; the project itself is the other axis that got interesting the
 * moment they arrived together.
 *
 * Both are pure functions over the summaries the list already has — the
 * projects to choose from are derived from the sessions themselves, so a
 * project only appears while it has something to show, and nothing has to be
 * fetched to draw the menu.
 */
import { dateCutoff, type DateFilter } from "@/lib/date-filter";
import type { ChatSummary } from "@byconvo/core/chats";

/** `all` is the unfiltered case; anything else is a project's absolute path. */
export type ProjectFilter = string;
export const ALL_PROJECTS: ProjectFilter = "all";

export interface ProjectOption {
  /** The project folder's absolute path — the filter's value. */
  readonly path: string;
  readonly name: string;
  readonly count: number;
}

/**
 * The projects represented in `chats`, by name, each with how many sessions it
 * holds. Two projects can share a folder name (`~/work/api`, `~/side/api`), so
 * the path stays the identity and only the label is the name.
 */
export const projectsOf = (
  chats: ReadonlyArray<ChatSummary>
): ReadonlyArray<ProjectOption> => {
  const counts = new Map<string, ProjectOption>();
  for (const chat of chats) {
    const existing = counts.get(chat.origin.projectPath);
    counts.set(chat.origin.projectPath, {
      path: chat.origin.projectPath,
      name: chat.origin.projectName,
      count: (existing?.count ?? 0) + 1,
    });
  }
  return [...counts.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path)
  );
};

export interface ChatFilters {
  readonly project: ProjectFilter;
  readonly date: DateFilter;
}

export const NO_FILTERS: ChatFilters = {
  project: ALL_PROJECTS,
  date: "all",
};

export const filterChats = (
  chats: ReadonlyArray<ChatSummary>,
  filters: ChatFilters
): ReadonlyArray<ChatSummary> => {
  const cutoff = dateCutoff(filters.date);
  return chats.filter(
    (chat) =>
      (filters.project === ALL_PROJECTS ||
        chat.origin.projectPath === filters.project) &&
      (cutoff === 0 || Date.parse(chat.updatedAt) >= cutoff)
  );
};

/**
 * The project filter to actually apply. A stored filter outlives the project it
 * names — a session list it once narrowed can be emptied, and a filter pointing
 * at nothing would leave the list permanently blank. It steps aside instead,
 * but only once there are sessions to check it against: mid-load everything is
 * absent, and that is not the same as gone.
 */
export const resolveProjectFilter = (
  projects: ReadonlyArray<ProjectOption>,
  project: ProjectFilter
): ProjectFilter =>
  project === ALL_PROJECTS ||
  projects.length === 0 ||
  projects.some((option) => option.path === project)
    ? project
    : ALL_PROJECTS;

/** The label for the project control — the project's name, or "All projects". */
export const projectFilterLabel = (
  chats: ReadonlyArray<ChatSummary>,
  project: ProjectFilter
): string => {
  if (project === ALL_PROJECTS) return "All projects";
  return (
    projectsOf(chats).find((option) => option.path === project)?.name ?? project
  );
};
