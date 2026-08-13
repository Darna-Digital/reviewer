/**
 * The sessions list's filters outlive the page. Narrowing to one project is a
 * statement about what you are working on, not about this visit, so it survives
 * navigating away and reloading the window — the storage it survives in is
 * injected, which is what keeps the parsing testable without a browser.
 */
import type { ChatFilters } from "../functions/chat-filters.functions";

export interface StoredChatFiltersDependencies {
  data: Record<string, never>;
  sideEffects: {
    /** The serialised filters, or null when nothing was ever stored. */
    readonly read: () => string | null;
    readonly write: (value: string) => void;
  };
}

export interface StoredChatFilters {
  /** Anything unreadable or no longer a filter reads as unfiltered. */
  readonly load: () => ChatFilters;
  readonly save: (filters: ChatFilters) => void;
}
