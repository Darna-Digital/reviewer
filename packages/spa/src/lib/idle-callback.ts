/**
 * `requestIdleCallback` for WebKit, which has never shipped it. The macOS
 * shell's islands run in WKWebView, and the strip primes its tabs — and the
 * launchpad boots its previews — once the window is idle, so without one the
 * code island fell over on its first render. Falling back to a timeout gives
 * up the idleness but keeps the deferral, which is the half that matters.
 */
const IDLE_FALLBACK_MS = 50;

type IdleWindow = Pick<Window, "requestIdleCallback" | "cancelIdleCallback">;

const install = (target: Partial<IdleWindow>): void => {
  if (target.requestIdleCallback !== undefined) return;
  target.requestIdleCallback = (callback, options) => {
    const start = Date.now();
    const delay = Math.min(
      IDLE_FALLBACK_MS,
      options?.timeout ?? IDLE_FALLBACK_MS
    );
    return window.setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () =>
          Math.max(0, IDLE_FALLBACK_MS - (Date.now() - start)),
      });
    }, delay);
  };
  target.cancelIdleCallback = (handle) => window.clearTimeout(handle);
};

if (typeof window !== "undefined") install(window);
