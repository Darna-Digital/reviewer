// How many people run Reviewer, counted from the update checks the apps
// already make: the Mac app's Sparkle feed and the TUI's look at the latest
// release both come here, and are redirected on to the same file on the
// latest GitHub release, so updates work as they always did.
//
// Nothing about the person is kept. The app itself decides whether this is
// its first check of the day, the week, the month, and says so in the query
// (`d`, `w`, `m`, `new`); the Worker writes one data point for the first
// check of a day and none for the rest, nor for an app opted out of counting,
// which sends no query at all. The IP is never read. What is counted is
// listed on reviewer.sh/privacy (routes/privacy.tsx) and in the README's
// Privacy section; keep all three in step.
//
// Data point layout, which the rollup (usage-rollup.ts) reads back:
//   blob1 app · blob2 local day · blob3 version · blob4 os · blob5 country
//   blob6 install month · double1 first this week · double2 first this
//   month · double3 new install
const RELEASES_URL = "https://github.com/Darna-Digital/reviewer/releases";

export type App = "mac" | "tui";

/** The user-agent each app checks with: Sparkle's, and the TUI's own. */
const USER_AGENT: Record<App, RegExp> = {
  mac: /^Reviewer\/(\d+\.\d+\.\d+) Sparkle\//,
  tui: /^reviewer-tui\/(\d+\.\d+\.\d+)$/,
};

const OS: Record<App, RegExp> = {
  mac: /^\d{2}$/,
  tui: /^(linux|darwin)$/,
};

export interface UsagePoint {
  blobs: [App, string, string, string, string, string];
  doubles: [number, number, number];
}

export interface UsageDataset {
  writeDataPoint: (point: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
  }) => void;
}

/** The check, counted when it is the day's first, redirected either way. */
export function usageResponse(
  request: Request,
  app: App,
  file: string,
  dataset: UsageDataset | undefined
): Response {
  const point = usagePoint(request, app);
  if (point && dataset) {
    try {
      dataset.writeDataPoint({ indexes: [app], ...point });
    } catch {
      // A lost count is no reason to fail an update check.
    }
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${RELEASES_URL}/latest/download/${file}`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * The data point a check stands for, or null when it is not a day's first
 * or does not hold together — a later check, an opted-out app, an older
 * build, or anything that only looks like one of ours.
 */
export function usagePoint(
  request: Request,
  app: App,
  now = new Date()
): UsagePoint | null {
  const query = new URL(request.url).searchParams;
  if (query.get("d") !== "1") return null;

  const version = USER_AGENT[app].exec(
    request.headers.get("User-Agent") ?? ""
  )?.[1];
  // Any well-formed version counts, including one newer than this site's
  // build: a release reaches apps before release.yml redeploys the site,
  // and its first checks would otherwise be lost while the app marks the
  // day counted.
  if (!version) return null;

  const day = query.get("day") ?? "";
  if (!isNearToday(day, now)) return null;

  const since = query.get("since") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(since) || since > day.slice(0, 7))
    return null;

  const flags = ["w", "m", "new"].map((key) => query.get(key));
  if (!flags.every((flag) => flag === "0" || flag === "1")) return null;
  const [week, month, isNew] = flags.map(Number);
  // A new install is counted on its first day, which is also the first of
  // its week and its month, in the month it was installed.
  if (isNew && (!week || !month || since !== day.slice(0, 7))) return null;

  const os = query.get("os") ?? "";
  if (!OS[app].test(os)) return null;

  const country = request.headers.get("CF-IPCountry") ?? "";
  return {
    blobs: [
      app,
      day,
      version,
      os,
      // XX is Cloudflare's "unknown", T1 its Tor
      /^[A-Z]{2}$/.test(country) && country !== "XX" ? country : "",
      since,
    ],
    doubles: [week, month, isNew],
  };
}

/**
 * A real `YYYY-MM-DD` within a day of the server's UTC date: the app sends
 * its own local date, which is never further off than that unless its
 * clock is wrong.
 */
function isNearToday(day: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day)
    return false;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.abs(date.getTime() - today) <= 86_400_000;
}
