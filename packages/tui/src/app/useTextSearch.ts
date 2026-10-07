import * as React from 'react';
import { grep } from '../git/files';
import type { GrepOptions, GrepResult } from '../git/files';

const DEBOUNCE_MS = 180;
export const MIN_QUERY = 2;

export interface TextSearch {
  result: GrepResult | null;
  searching: boolean;
  failed: boolean;
}

/** Debounced `git grep`; the last results stay up while the next ones load. */
export function useTextSearch(
  root: string,
  query: string,
  options: GrepOptions,
): TextSearch {
  const [state, setState] = React.useState<TextSearch>({
    result: null,
    searching: false,
    failed: false,
  });
  const { caseSensitive, wholeWord, regex } = options;

  React.useEffect(() => {
    if (query.trim().length < MIN_QUERY) {
      setState({ result: null, searching: false, failed: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, searching: true }));
    const timer = setTimeout(() => {
      grep(root, query, { caseSensitive, wholeWord, regex }).then(
        (result) =>
          !cancelled && setState({ result, searching: false, failed: false }),
        () =>
          !cancelled &&
          setState({ result: null, searching: false, failed: true }),
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [root, query, caseSensitive, wholeWord, regex]);

  return state;
}
