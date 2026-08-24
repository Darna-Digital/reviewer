/**
 * Wires the real formatting API into the pure logic.
 *
 * Detection is a query: settings and every open file ask the same question, and
 * the answer only changes when the project's dependencies do. Formatting is a
 * one-shot POST — it answers a save, and a cached reprint of a buffer the user
 * has typed past would be worse than no formatting at all.
 */
import { useMemo } from "react";
import { toast } from "sonner";
import { api, fetchClient } from "@/lib/api/client";
import { useUiPrefs } from "@/lib/ui-prefs";
import { createFormattingFunctions } from "../functions/formatting.functions";
import type { FormattingFunctions } from "../interfaces/formatting.interfaces";

/** How long the detected formatter stays fresh — a dependency install is rare. */
const FORMATTER_STALE_MS = 60_000;

/** The formatter this project configures, and whether it can run. */
export const useFormatter = () =>
  api.useQuery(
    "get",
    "/api/formatting/formatter",
    {},
    { staleTime: FORMATTER_STALE_MS, retry: false }
  );

/**
 * Formatting on save, bound to the real API and the user's preference. A
 * project without a formatter, or a user who has turned it off, gets functions
 * that hand the buffer straight back — the caller has nothing to decide.
 */
export const useFormatOnSave = (): FormattingFunctions => {
  const prefs = useUiPrefs();
  const formatter = useFormatter();
  const available = formatter.data?.available ?? false;

  return useMemo(
    () =>
      createFormattingFunctions({
        data: { enabled: prefs.formatOnSave, available },
        sideEffects: {
          format: async (path, contents) => {
            const { data, error } = await fetchClient.POST(
              "/api/formatting/format",
              { body: { path, contents } }
            );
            if (error)
              throw new Error(
                (error as { reason?: string }).reason ?? "could not format"
              );
            return data;
          },
          onFailure: (reason) =>
            toast.error(`Saved without formatting: ${reason}`),
        },
      }),
    [prefs.formatOnSave, available]
  );
};
