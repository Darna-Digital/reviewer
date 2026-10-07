import * as React from 'react';
import { ensureServer, SERVER_PORT } from '../process/reviewerServer';
import type { Review } from './useReview';

/** Makes sure the Reviewer server is up, so the Mac app and skills find it. */
export function useServer(review: Review, enabled: boolean) {
  const { root, notify } = review;
  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const slow = setTimeout(
      () => !cancelled && notify('info', 'Starting the Reviewer server…'),
      1200,
    );
    void ensureServer(root).then((outcome) => {
      clearTimeout(slow);
      if (cancelled) return;
      if (outcome.kind === 'started')
        notify('success', `Reviewer server started on :${SERVER_PORT}`);
      if (outcome.kind === 'failed')
        notify('error', `Reviewer server not started: ${outcome.reason}`);
    });
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, [enabled, root, notify]);
}
