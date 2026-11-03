import { DATE_FILTERS, type DateFilter } from "@/lib/date-filter";
import type {
  StoredChatFilters,
  StoredChatFiltersDependencies,
} from "../interfaces/chat-filters.interfaces";
import {
  ALL_PLACES,
  NO_FILTERS,
  type ChatFilters,
  type PlaceFilter,
} from "./chat-filters.functions";

const isDateFilter = (value: unknown): value is DateFilter =>
  DATE_FILTERS.some((filter) => filter.value === value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parsePlace = (value: unknown): PlaceFilter => {
  if (!isRecord(value)) return ALL_PLACES;
  if (value.kind === "workspace" && typeof value.id === "string") {
    return { kind: "workspace", id: value.id };
  }
  if (value.kind === "repo" && typeof value.path === "string") {
    return { kind: "repo", path: value.path };
  }
  return ALL_PLACES;
};

/**
 * Before workspaces the list was narrowed to a project folder, which for a
 * folder holding one repository is that repository — so a stored project
 * carries over as the repository of the same path, and a folder of several
 * steps aside once the places arrive (see `resolvePlaceFilter`).
 */
const placeFromProject = (project: unknown): PlaceFilter =>
  typeof project === "string" && project !== "all"
    ? { kind: "repo", path: project }
    : ALL_PLACES;

/**
 * Stored filters are read back one field at a time: the time windows on offer
 * can change between releases, and a window that no longer exists must not
 * leave the list narrowed by something the menu cannot even show.
 */
export const parseChatFilters = (raw: string | null): ChatFilters => {
  if (raw === null) return NO_FILTERS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return NO_FILTERS;
    return {
      place:
        "place" in parsed
          ? parsePlace(parsed.place)
          : placeFromProject(parsed.project),
      date: isDateFilter(parsed.date) ? parsed.date : NO_FILTERS.date,
    };
  } catch {
    return NO_FILTERS;
  }
};

export function createStoredChatFilters(
  d: StoredChatFiltersDependencies
): StoredChatFilters {
  return {
    load: () => parseChatFilters(d.sideEffects.read()),
    save: (filters) =>
      d.sideEffects.write(
        JSON.stringify({ place: filters.place, date: filters.date })
      ),
  };
}
