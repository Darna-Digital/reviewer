import { DATE_FILTERS, type DateFilter } from "@/lib/date-filter";
import type {
  StoredChatFilters,
  StoredChatFiltersDependencies,
} from "../interfaces/chat-filters.interfaces";
import {
  ALL_PROJECTS,
  NO_FILTERS,
  type ChatFilters,
} from "./chat-filters.functions";

const isDateFilter = (value: unknown): value is DateFilter =>
  DATE_FILTERS.some((filter) => filter.value === value);

/**
 * Stored filters are read back one field at a time: the time windows on offer
 * can change between releases, and a window that no longer exists must not
 * leave the list narrowed by something the menu cannot even show.
 */
export const parseChatFilters = (raw: string | null): ChatFilters => {
  if (raw === null) return NO_FILTERS;
  try {
    const parsed = JSON.parse(raw) as Partial<ChatFilters>;
    return {
      project:
        typeof parsed.project === "string" ? parsed.project : ALL_PROJECTS,
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
        JSON.stringify({ project: filters.project, date: filters.date })
      ),
  };
}
