import { describe, expect, it } from "vitest";
import { threadsByComment } from "./review-threads.ts";

describe("threadsByComment", () => {
  it("files every comment under its thread, resolved or not", () => {
    const threads = threadsByComment({
      repository: {
        pullRequest: {
          reviewThreads: {
            nodes: [
              {
                id: "PRRT_open",
                isResolved: false,
                comments: { nodes: [{ databaseId: 1 }, { databaseId: 2 }] },
              },
              {
                id: "PRRT_done",
                isResolved: true,
                comments: { nodes: [{ databaseId: 3 }] },
              },
            ],
          },
        },
      },
    });
    expect(threads.get(1)).toEqual({ thread: "PRRT_open", resolved: false });
    expect(threads.get(2)).toEqual({ thread: "PRRT_open", resolved: false });
    expect(threads.get(3)).toEqual({ thread: "PRRT_done", resolved: true });
  });

  it("reads a shape it did not expect as no threads", () => {
    expect(threadsByComment(null).size).toBe(0);
    expect(threadsByComment({ repository: null }).size).toBe(0);
    expect(
      threadsByComment({
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                { isResolved: true, comments: { nodes: [{ databaseId: 9 }] } },
              ],
            },
          },
        },
      }).size
    ).toBe(0);
  });
});
