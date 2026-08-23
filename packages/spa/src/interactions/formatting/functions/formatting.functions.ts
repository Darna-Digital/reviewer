/**
 * What a save does when the project formats its code.
 *
 * The rule the whole feature rests on: a save always writes. Formatting is an
 * improvement applied on the way, and every way it can fail — the formatter is
 * not installed, the file has a syntax error it cannot parse, the request never
 * comes back — falls through to writing what the user typed. Losing a save
 * because a formatter had an opinion would be far worse than saving unformatted
 * code.
 */
import type {
  FormatOutcome,
  FormattingDependencies,
  FormattingFunctions,
} from "../interfaces/formatting.interfaces";
import { minimalEdit } from "./format-edit";

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export function createFormattingFunctions(
  deps: FormattingDependencies
): FormattingFunctions {
  const unchanged = (contents: string): FormatOutcome => ({
    contents,
    edit: null,
  });

  return {
    formatBeforeSave: async (path, contents) => {
      if (!deps.data.enabled || !deps.data.available)
        return unchanged(contents);
      try {
        const result = await deps.sideEffects.format(path, contents);
        // `changed` is the server's word for it; comparing the text as well
        // covers a formatter that reports having reprinted an identical file.
        if (!result.changed || result.contents === contents)
          return unchanged(contents);
        return {
          contents: result.contents,
          edit: minimalEdit(contents, result.contents),
        };
      } catch (cause) {
        deps.sideEffects.onFailure(reasonOf(cause));
        return unchanged(contents);
      }
    },
  };
}
