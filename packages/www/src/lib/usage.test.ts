import { describe, expect, it } from "vitest";

import { usagePoint, usageResponse } from "./usage";
import type { App } from "./usage";

const NOW = new Date("2026-11-05T10:00:00Z");
const MAC_UA = "Reviewer/0.0.42 Sparkle/2.10.0";
const TUI_UA = "reviewer-tui/0.0.41";

const FIRST_OF_DAY = {
  d: "1",
  day: "2026-11-05",
  w: "0",
  m: "0",
  new: "0",
  since: "2026-10",
  os: "26",
};

function check(
  query: Record<string, string>,
  userAgent = MAC_UA,
  country = "LT"
): Request {
  return new Request(
    `https://reviewer.sh/appcast.xml?${new URLSearchParams(query)}`,
    { headers: { "User-Agent": userAgent, "CF-IPCountry": country } }
  );
}

function point(request: Request, app: App = "mac") {
  return usagePoint(request, app, NOW);
}

describe("usagePoint", () => {
  it("counts a day's first check with what it says", () => {
    expect(point(check({ ...FIRST_OF_DAY, w: "1" }))).toEqual({
      blobs: ["mac", "2026-11-05", "0.0.42", "26", "LT", "2026-10"],
      doubles: [1, 0, 0],
    });
  });

  it("counts the TUI by its own user-agent and OS names", () => {
    const request = check({ ...FIRST_OF_DAY, os: "linux" }, TUI_UA);
    expect(point(request, "tui")?.blobs.slice(0, 4)).toEqual([
      "tui",
      "2026-11-05",
      "0.0.41",
      "linux",
    ]);
    expect(point(request, "mac")).toBeNull();
  });

  it("counts a release newer than the site's build", () => {
    expect(
      point(check(FIRST_OF_DAY, "Reviewer/0.1.0 Sparkle/2.10.0"))?.blobs[2]
    ).toBe("0.1.0");
  });

  it("takes the app's local day a time zone either side of UTC", () => {
    expect(point(check({ ...FIRST_OF_DAY, day: "2026-11-06" }))).not.toBeNull();
    expect(point(check({ ...FIRST_OF_DAY, day: "2026-11-04" }))).not.toBeNull();
  });

  it("counts a new install, which is the first of its week and month too", () => {
    const fresh = { ...FIRST_OF_DAY, since: "2026-11", new: "1" };
    expect(point(check({ ...fresh, w: "1", m: "1" }))?.doubles).toEqual([
      1, 1, 1,
    ]);
    expect(point(check({ ...fresh, w: "1", m: "0" }))).toBeNull();
    expect(
      point(check({ ...fresh, since: "2026-10", w: "1", m: "1" }))
    ).toBeNull();
  });

  it("leaves out a country Cloudflare could not place", () => {
    expect(point(check(FIRST_OF_DAY, MAC_UA, "XX"))?.blobs[4]).toBe("");
    expect(point(check(FIRST_OF_DAY, MAC_UA, "T1"))?.blobs[4]).toBe("");
  });

  it.each([
    ["a later check of the day", { ...FIRST_OF_DAY, d: "0" }, MAC_UA],
    ["an opted-out app", {}, MAC_UA],
    ["a day two days off", { ...FIRST_OF_DAY, day: "2026-11-07" }, MAC_UA],
    [
      "a date that does not exist",
      { ...FIRST_OF_DAY, day: "2026-02-30" },
      MAC_UA,
    ],
    [
      "an install month after the day",
      { ...FIRST_OF_DAY, since: "2026-12" },
      MAC_UA,
    ],
    ["a flag that is not 0 or 1", { ...FIRST_OF_DAY, w: "2" }, MAC_UA],
    [
      "an OS that is not a major version",
      { ...FIRST_OF_DAY, os: "26.1" },
      MAC_UA,
    ],
    [
      "a version that is not X.Y.Z",
      FIRST_OF_DAY,
      "Reviewer/0.1 Sparkle/2.10.0",
    ],
    ["a user-agent that is not Sparkle's", FIRST_OF_DAY, "curl/8.0"],
  ])("counts nothing for %s", (_, query, userAgent) => {
    expect(point(check(query, userAgent))).toBeNull();
  });
});

describe("usageResponse", () => {
  function dataset() {
    const written: unknown[] = [];
    return { written, writeDataPoint: (p: unknown) => void written.push(p) };
  }

  it("redirects to the latest release's file, uncached", () => {
    const response = usageResponse(check({}), "mac", "appcast.xml", dataset());
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://github.com/Darna-Digital/reviewer/releases/latest/download/appcast.xml"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("writes one point for a first check and none for a later one", () => {
    const usage = dataset();
    const first = check(
      { ...FIRST_OF_DAY, day: new Date().toISOString().slice(0, 10) },
      "Reviewer/0.0.1 Sparkle/2.10.0"
    );
    usageResponse(first, "mac", "appcast.xml", usage);
    usageResponse(check({ d: "0" }), "mac", "appcast.xml", usage);
    expect(usage.written).toHaveLength(1);
  });

  it("still redirects when the write fails", () => {
    const failing = {
      writeDataPoint() {
        throw new Error("dataset unavailable");
      },
    };
    const first = check(
      { ...FIRST_OF_DAY, day: new Date().toISOString().slice(0, 10) },
      "Reviewer/0.0.1 Sparkle/2.10.0"
    );
    expect(usageResponse(first, "mac", "appcast.xml", failing).status).toBe(
      302
    );
  });
});
