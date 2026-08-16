import { describe, expect, it } from "vitest";
import {
  BACKGROUND_REFRESH_MS,
  captureOrder,
  isSnapshotDue,
  isSnapshotWorthKeeping,
  SNAPSHOT_MAX_CHARS,
  SNAPSHOT_REFRESH_MS,
  type TabSnapshot,
} from "./tab-snapshot.functions";
import type { PreviewCapture } from "./preview-capture.functions";

const capture = (patch: Partial<PreviewCapture> = {}): PreviewCapture => ({
  html: "<div>hi</div>",
  shadowSheets: {},
  rootAttrs: {},
  bodyAttrs: {},
  width: 1280,
  height: 800,
  ...patch,
});

describe("isSnapshotWorthKeeping", () => {
  it("keeps a page that was rendered at a size worth scaling down", () => {
    expect(isSnapshotWorthKeeping(capture())).toBe(true);
  });

  it("refuses a page too large to be worth holding a picture of", () => {
    expect(
      isSnapshotWorthKeeping(
        capture({ html: "x".repeat(SNAPSHOT_MAX_CHARS + 1) })
      )
    ).toBe(false);
  });

  it("refuses a page that was never laid out, which has nothing to show", () => {
    expect(isSnapshotWorthKeeping(capture({ width: 0 }))).toBe(false);
    expect(isSnapshotWorthKeeping(capture({ height: 0 }))).toBe(false);
  });
});

describe("captureOrder", () => {
  it("starts at the section being looked at and comes back round to the rest", () => {
    expect(captureOrder(["a", "b", "c", "d"], 2)).toEqual(["c", "d", "a", "b"]);
  });

  it("starts at the beginning when the window is on none of them", () => {
    expect(captureOrder(["a", "b"], -1)).toEqual(["a", "b"]);
  });

  it("has nothing to do with nothing to photograph", () => {
    expect(captureOrder([], 0)).toEqual([]);
  });
});

describe("isSnapshotDue", () => {
  const drawn = (at: number): TabSnapshot => ({ ...capture(), at });

  it("always wants a section that has never been drawn", () => {
    expect(isSnapshotDue(undefined, 0, false)).toBe(true);
    expect(isSnapshotDue(undefined, 1_000_000, true)).toBe(true);
  });

  it("leaves a picture alone until its own clock is up", () => {
    const at = 10_000;
    expect(isSnapshotDue(drawn(at), at + SNAPSHOT_REFRESH_MS - 1, true)).toBe(
      false
    );
    expect(isSnapshotDue(drawn(at), at + SNAPSHOT_REFRESH_MS, true)).toBe(true);
  });

  it("comes round for a watched panel sooner than a shut one", () => {
    const at = 10_000;
    const now = at + SNAPSHOT_REFRESH_MS;
    expect(isSnapshotDue(drawn(at), now, true)).toBe(true);
    expect(isSnapshotDue(drawn(at), now, false)).toBe(false);
    expect(isSnapshotDue(drawn(at), at + BACKGROUND_REFRESH_MS, false)).toBe(
      true
    );
  });
});
