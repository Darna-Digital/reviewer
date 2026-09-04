import { describe, expect, it } from "vitest";
import { targetOf } from "./branch-targets.functions";

describe("targetOf", () => {
  const targets = [{ branch: "fix/login", target: "development" }];

  it("reads where a branch's work is aimed", () => {
    expect(targetOf(targets, "fix/login")).toBe("development");
  });

  it("is null for a branch that was never aimed anywhere", () => {
    expect(targetOf(targets, "master")).toBeNull();
  });

  it("is null when no branch is checked out at all", () => {
    expect(targetOf(targets, null)).toBeNull();
  });
});
