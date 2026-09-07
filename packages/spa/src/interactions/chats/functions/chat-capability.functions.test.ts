import { describe, expect, it } from "vitest";
import {
  accessOptions,
  effortLabel,
  effortOptions,
} from "./chat-capability.functions";

describe("effortOptions", () => {
  it("runs shallow to deep whatever order the CLI listed them in", () => {
    expect(effortOptions(["max", "low", "high"]).map((o) => o.value)).toEqual([
      "low",
      "high",
      "max",
    ]);
  });

  it("offers a level reviewer has never seen, under its own name", () => {
    // The levels are the agent's, not ours: an unknown one reaches the menu
    // rather than being dropped for having no copy written for it.
    const options = effortOptions(["turbo"]);
    expect(options).toEqual([{ value: "turbo", label: "Turbo", hint: "" }]);
    expect(effortLabel("xhigh")).toBe("Extra high");
  });

  it("has nothing to show when the agent decides for itself", () => {
    expect(effortOptions([])).toEqual([]);
  });
});

describe("accessOptions", () => {
  it("shows only the tiers it was handed", () => {
    expect(
      accessOptions(["supervised", "fullAccess"]).map((o) => o.label)
    ).toEqual(["Supervised", "Full access"]);
  });
});
