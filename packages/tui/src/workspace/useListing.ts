import * as React from 'react';
import { workspaces } from './client';
import type { KnownRepos, SavedWorkspace } from './client';

export interface Listing extends KnownRepos {
  saved: readonly SavedWorkspace[];
  loading: boolean;
  error: string | null;
}

const EMPTY: Listing = {
  saved: [],
  recent: [],
  found: [],
  loading: true,
  error: null,
};

/** The saved workspaces and known repositories, read from the server once per opening. */
export function useListing(): Listing {
  const [listing, setListing] = React.useState(EMPTY);
  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([workspaces.list(), workspaces.known()]).then(
      ([saved, known]) =>
        !cancelled &&
        setListing({ saved, ...known, loading: false, error: null }),
      (error: unknown) =>
        !cancelled &&
        setListing({
          ...EMPTY,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return listing;
}
