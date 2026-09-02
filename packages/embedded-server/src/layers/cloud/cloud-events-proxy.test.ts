import { describe, expect, it } from "vitest";
import {
  cloudEventsRunId,
  cloudStreamHeaders,
  cloudStreamUrl,
  parseAfter,
} from "./cloud-events-proxy.ts";

describe("cloudEventsRunId", () => {
  it("reads the run id out of the events path", () => {
    expect(cloudEventsRunId("/api/cloud/runs/run-1/events")).toBe("run-1");
    expect(cloudEventsRunId("/api/cloud/runs/a%2Fb/events")).toBe("a/b");
  });

  it("is not the route for anything else under /api/cloud", () => {
    expect(cloudEventsRunId("/api/cloud/runs")).toBeNull();
    expect(cloudEventsRunId("/api/cloud/runs/run-1")).toBeNull();
    expect(cloudEventsRunId("/api/cloud/runs/run-1/messages")).toBeNull();
    expect(cloudEventsRunId("/api/cloud/runs//events")).toBeNull();
    expect(cloudEventsRunId("/api/cloud/runs/a/b/events")).toBeNull();
    expect(cloudEventsRunId("/api/chats/stream")).toBeNull();
  });
});

describe("parseAfter", () => {
  it("reads a sequence number and floors it", () => {
    expect(parseAfter("12")).toBe(12);
    expect(parseAfter("12.7")).toBe(12);
  });

  it("starts from the beginning for anything unreadable", () => {
    expect(parseAfter(null)).toBe(0);
    expect(parseAfter(undefined)).toBe(0);
    expect(parseAfter("-3")).toBe(0);
    expect(parseAfter("later")).toBe(0);
  });
});

describe("cloudStreamUrl", () => {
  it("builds the cloud's stream url from a point in the log", () => {
    expect(cloudStreamUrl("https://cloud.test", "run-1", 7)).toBe(
      "https://cloud.test/api/runs/run-1/stream?after=7"
    );
  });

  it("tolerates a trailing slash and escapes the id", () => {
    expect(cloudStreamUrl("https://cloud.test/", "a/b", 0)).toBe(
      "https://cloud.test/api/runs/a%2Fb/stream?after=0"
    );
  });
});

describe("cloudStreamHeaders", () => {
  it("carries the bearer and asks for an event stream", () => {
    expect(cloudStreamHeaders("tok")).toEqual({
      authorization: "Bearer tok",
      accept: "text/event-stream",
    });
  });
});
