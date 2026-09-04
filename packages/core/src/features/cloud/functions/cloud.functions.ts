/**
 * The pure rules of connecting: how a typed server address is read, and how
 * the device flow's polling is paced.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

const hostOf = (url: string): string =>
  url
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[/?#]/)[0]
    ?.split("@")
    .at(-1)
    ?.replace(/:\d+$/, "")
    .toLowerCase() ?? "";

/**
 * A server address as the person typed it, made into the origin the client
 * calls: whitespace off, `https://` assumed when no scheme was given, and no
 * trailing slash so paths can be appended. Plain `http://` is kept only for a
 * local server — anything else on the open network is upgraded.
 */
export const normalizeServerUrl = (input: string): string => {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const secure =
    /^http:\/\//i.test(withScheme) && !LOCAL_HOSTS.has(hostOf(withScheme))
      ? withScheme.replace(/^http:\/\//i, "https://")
      : withScheme;
  return secure.replace(/\/+$/, "");
};

/** The smallest interval a device poll should ever use. */
export const MIN_DEVICE_POLL_MS = 1_000;
/** What `slow_down` asks for: five seconds on top of the interval (RFC 8628). */
export const SLOW_DOWN_STEP_MS = 5_000;

/**
 * How long to wait before the next device poll. The server names its interval
 * in seconds; a `slow_down` answer means that interval was still too eager.
 */
export const devicePollDelayMs = (
  intervalSeconds: number,
  slowDown: boolean
): number => {
  const base =
    Number.isFinite(intervalSeconds) && intervalSeconds > 0
      ? intervalSeconds * 1_000
      : 5_000;
  return Math.max(
    MIN_DEVICE_POLL_MS,
    base + (slowDown ? SLOW_DOWN_STEP_MS : 0)
  );
};

/** The device-flow error codes that mean "keep polling". */
export const isDevicePending = (error: unknown): boolean => {
  const code =
    typeof error === "string"
      ? error
      : typeof error === "object" &&
          error !== null &&
          "error" in error &&
          typeof error.error === "string"
        ? (error as { error: string }).error
        : null;
  return code === "authorization_pending" || code === "slow_down";
};

/** When a code handed out now stops being accepted. */
export const deviceExpiresAt = (expiresInSeconds: number, now: Date): string =>
  new Date(now.getTime() + Math.max(0, expiresInSeconds) * 1_000).toISOString();
