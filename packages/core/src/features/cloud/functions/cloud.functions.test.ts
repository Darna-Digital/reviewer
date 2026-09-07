import { describe, expect, it } from "vitest";
import {
  deviceExpiresAt,
  devicePollDelayMs,
  isDevicePending,
  normalizeServerUrl,
} from "./cloud.functions.ts";

describe("normalizeServerUrl", () => {
  it("assumes https when no scheme is typed", () => {
    expect(normalizeServerUrl("api.reviewer.darnadigital.com")).toBe(
      "https://api.reviewer.darnadigital.com"
    );
  });

  it("trims whitespace and trailing slashes", () => {
    expect(
      normalizeServerUrl("  https://api.reviewer.darnadigital.com//  ")
    ).toBe("https://api.reviewer.darnadigital.com");
  });

  it("keeps plain http for a local server", () => {
    expect(normalizeServerUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000"
    );
    expect(normalizeServerUrl("http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000"
    );
  });

  it("upgrades plain http elsewhere", () => {
    expect(normalizeServerUrl("http://api.reviewer.darnadigital.com")).toBe(
      "https://api.reviewer.darnadigital.com"
    );
  });

  it("has nothing to say about a blank address", () => {
    expect(normalizeServerUrl("   ")).toBe("");
  });
});

describe("devicePollDelayMs", () => {
  it("uses the server's interval", () => {
    expect(devicePollDelayMs(5, false)).toBe(5_000);
  });

  it("adds five seconds after a slow_down", () => {
    expect(devicePollDelayMs(5, true)).toBe(10_000);
  });

  it("falls back to five seconds for a nonsense interval", () => {
    expect(devicePollDelayMs(0, false)).toBe(5_000);
    expect(devicePollDelayMs(Number.NaN, false)).toBe(5_000);
  });

  it("never polls faster than once a second", () => {
    expect(devicePollDelayMs(0.1, false)).toBe(1_000);
  });
});

describe("isDevicePending", () => {
  it("recognises the two codes that mean keep polling", () => {
    expect(isDevicePending("authorization_pending")).toBe(true);
    expect(isDevicePending({ error: "slow_down" })).toBe(true);
  });

  it("treats the settled codes as not pending", () => {
    expect(isDevicePending("expired_token")).toBe(false);
    expect(isDevicePending({ error: "access_denied" })).toBe(false);
    expect(isDevicePending(null)).toBe(false);
  });
});

describe("deviceExpiresAt", () => {
  it("counts the lifetime from now", () => {
    expect(deviceExpiresAt(600, new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "2026-01-01T00:10:00.000Z"
    );
  });
});
