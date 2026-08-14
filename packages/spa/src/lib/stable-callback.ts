/**
 * A callback whose identity never changes, but which always runs the newest
 * version of itself.
 *
 * `React.memo` only earns anything if the props it compares are actually
 * stable, and the usual thing that ruins that is a handler written inline in
 * the parent: `onSelect={(x) => doThing(x)}` is a different function on every
 * render, so a memoised child re-renders every time regardless. The standard
 * answer is `useCallback` with a dependency list, and the standard failure of
 * that answer is a list that misses something and leaves the handler holding
 * values from an old render.
 *
 * This is the other answer — React's own `useEffectEvent` shape. The latest
 * implementation is parked in a ref on every render and the returned wrapper
 * reads it at call time, so the identity is stable *and* the closure is never
 * stale. There is no dependency list to get wrong.
 *
 * Only for event handlers — things called in response to something happening.
 * A value read *during* rendering must not come through here: the wrapper is
 * deliberately not a signal that anything changed, which is the whole point.
 */
import { useCallback, useLayoutEffect, useRef } from "react";

type AnyCallback = (...args: Array<any>) => any;

/** A stable wrapper around `callback` that always calls its latest version. */
export function useStableCallback<T extends AnyCallback>(callback: T): T {
  const latest = useRef(callback);
  // Layout, not passive: a handler fired by a commit-time effect further down
  // the tree must already see this render's implementation.
  useLayoutEffect(() => {
    latest.current = callback;
  });
  return useCallback(((...args) => latest.current(...args)) as T, []);
}

/**
 * The same, for a callback that may be absent — where *whether* there is a
 * handler is itself meaningful (a control is only rendered when one is given).
 * Returns `undefined` when `callback` is, so that distinction survives, and a
 * stable wrapper when it is not.
 */
export function useStableOptionalCallback<T extends AnyCallback>(
  callback: T | undefined
): T | undefined {
  const stable = useStableCallback(((...args) => callback?.(...args)) as T);
  return callback === undefined ? undefined : stable;
}
