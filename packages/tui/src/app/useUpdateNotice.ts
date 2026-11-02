import * as React from 'react';
import { newerRelease } from '../release/install';
import type { Review } from './useReview';

/** Past the server's own notices at launch. */
const SETTLE_MS = 2500;

/** Says once per launch when a newer release than this installed one is out. */
export function useUpdateNotice(review: Review) {
  const { notify } = review;
  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void newerRelease().then(
        (version) =>
          !cancelled &&
          version &&
          notify('info', `Reviewer ${version} is out — run reviewer upgrade`),
      );
    }, SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [notify]);
}
