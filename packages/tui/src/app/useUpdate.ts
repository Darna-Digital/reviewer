import * as React from 'react';
import {
  installedRelease,
  installRelease,
  isNewer,
  latestRelease,
  newerRelease,
  VERSION,
} from '../release/install';
import type { Review } from './useReview';

/** Past the server's own notices at launch. */
const SETTLE_MS = 2500;
/** A TUI stays open for days; look again now and then, as the Mac app does. */
const RECHECK_MS = 6 * 60 * 60 * 1000;

export type Update = ReturnType<typeof useUpdate>;

/**
 * Newer releases of this install: said once each, then installed in the
 * background and restarted into from the palette.
 */
export function useUpdate(review: Review) {
  const { notify } = review;
  const fail = (error: unknown) =>
    notify('error', error instanceof Error ? error.message : String(error));
  const managed = React.useMemo(() => installedRelease() !== null, []);
  const [available, setAvailable] = React.useState<string | null>(null);
  const [installing, setInstalling] = React.useState(false);
  const [installed, setInstalled] = React.useState<string | null>(null);
  const announced = React.useRef<string | null>(null);

  const announce = React.useCallback(
    (version: string) => {
      setAvailable(version);
      if (announced.current === version) return;
      announced.current = version;
      notify('info', `Reviewer ${version} is out — ⌘K › update Reviewer`);
    },
    [notify],
  );

  React.useEffect(() => {
    if (!managed) return;
    let cancelled = false;
    const check = () =>
      void newerRelease().then(
        (version) => !cancelled && version && announce(version),
      );
    const first = setTimeout(check, SETTLE_MS);
    const again = setInterval(check, RECHECK_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(again);
    };
  }, [managed, announce]);

  return {
    /** Installed with the one-line installer, so it can update itself. */
    managed,
    /** A newer release than the one running, not installed yet. */
    available:
      available && (!installed || isNewer(available, installed))
        ? available
        : null,
    installing,
    /** The release installed since launch, waiting for a restart. */
    installed,

    async check() {
      notify('info', 'Checking for updates…');
      try {
        const latest = await latestRelease();
        if (isNewer(latest, installed ?? VERSION)) {
          announced.current = null;
          announce(latest);
        } else {
          notify('success', `Reviewer ${installed ?? VERSION} is up to date`);
        }
      } catch (error) {
        fail(error);
      }
    },

    async install() {
      if (!available || available === installed || installing) return;
      setInstalling(true);
      notify('info', `Installing Reviewer ${available}…`);
      try {
        await installRelease(available);
        setInstalled(available);
        notify(
          'success',
          `Reviewer ${available} is installed — ⌘K › restart Reviewer`,
        );
      } catch (error) {
        fail(error);
      } finally {
        setInstalling(false);
      }
    },
  };
}
