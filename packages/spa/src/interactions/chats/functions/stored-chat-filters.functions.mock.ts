/** Mock dependencies for the stored session filters — storage in a variable. */
import type { StoredChatFiltersDependencies } from "../interfaces/chat-filters.interfaces";

export function mockStoredChatFiltersDependencies(
  initial: string | null = null
): {
  deps: StoredChatFiltersDependencies;
  written: string[];
} {
  let stored = initial;
  const written: string[] = [];
  return {
    deps: {
      data: {},
      sideEffects: {
        read: () => stored,
        write: (value) => {
          stored = value;
          written.push(value);
        },
      },
    },
    written,
  };
}
