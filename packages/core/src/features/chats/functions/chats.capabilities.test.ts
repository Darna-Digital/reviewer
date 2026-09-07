import { describe, expect, it } from "vitest";
import {
  chatAccessTiers,
  chatCapabilities,
  catalogCapabilities,
  nearestEffort,
  resolveChatAccess,
  withinCapabilities,
} from "./chats.capabilities.ts";
import type { ChatModelCatalog } from "../schema/chats.schema.ts";

const catalog: ChatModelCatalog = {
  providers: [
    { id: "claude", label: "Claude", models: [{ id: "opus", label: "Opus" }] },
    {
      id: "codex",
      label: "Codex",
      models: [
        {
          id: "gpt-5.6-sol",
          label: "Sol",
          efforts: ["low", "medium", "high", "xhigh", "max", "ultra"],
        },
        { id: "gpt-5.5", label: "5.5", efforts: ["low", "medium", "high"] },
      ],
    },
    {
      id: "opencode",
      label: "opencode",
      models: [
        {
          id: "opencode/claude-haiku-4-5",
          label: "Haiku",
          efforts: ["high", "max"],
        },
        { id: "opencode/big-pickle", label: "Big Pickle" },
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      models: [{ id: "composer-2.5", label: "Composer 2.5" }],
    },
  ],
  defaults: {
    provider: "claude",
    model: "",
    effort: "high",
    access: "fullAccess",
  },
};

describe("chatCapabilities", () => {
  it("offers each codex model the levels that model reported", () => {
    expect(
      catalogCapabilities(catalog, "codex", "gpt-5.6-sol").efforts
    ).toContain("ultra");
    expect(
      catalogCapabilities(catalog, "codex", "gpt-5.5").efforts
    ).not.toContain("ultra");
  });

  it("offers opencode the model's variants, and nothing when it named none", () => {
    expect(
      catalogCapabilities(catalog, "opencode", "opencode/claude-haiku-4-5")
        .efforts
    ).toEqual(["high", "max"]);
    // `--variant` speaks the model's own vocabulary, so there is nothing to
    // guess with — the menu goes away rather than offering levels it invented.
    expect(
      catalogCapabilities(catalog, "opencode", "opencode/big-pickle").efforts
    ).toEqual([]);
  });

  it("gives cursor no effort menu at all", () => {
    expect(
      catalogCapabilities(catalog, "cursor", "composer-2.5").efforts
    ).toEqual([]);
  });

  it("keeps codex's menu when its CLI never answered", () => {
    // An unreachable CLI should cost the setting's precision, not the setting.
    expect(chatCapabilities("codex", undefined).efforts).toEqual([
      "low",
      "medium",
      "high",
    ]);
  });

  it("offers claude the levels its thinking budget covers", () => {
    expect(chatCapabilities("claude", undefined).efforts).toEqual([
      "low",
      "medium",
      "high",
    ]);
  });
});

describe("access tiers", () => {
  it("keeps all three where the agent can tell them apart", () => {
    expect(chatAccessTiers("claude")).toEqual([
      "supervised",
      "acceptEdits",
      "fullAccess",
    ]);
    expect(chatAccessTiers("codex")).toEqual([
      "supervised",
      "acceptEdits",
      "fullAccess",
    ]);
  });

  it("drops the tier a one-switch agent cannot express", () => {
    expect(chatAccessTiers("cursor")).toEqual(["supervised", "fullAccess"]);
    expect(chatAccessTiers("opencode")).toEqual(["supervised", "fullAccess"]);
  });

  it("resolves a stored tier to the one that agent really runs at", () => {
    // cursor's `--force` is what auto-accept has always meant there; opencode
    // has no such switch, so the same tier leaves its config in charge.
    expect(resolveChatAccess("cursor", "acceptEdits")).toBe("fullAccess");
    expect(resolveChatAccess("opencode", "acceptEdits")).toBe("supervised");
    expect(resolveChatAccess("claude", "acceptEdits")).toBe("acceptEdits");
  });
});

describe("nearestEffort", () => {
  it("keeps a level the model offers", () => {
    expect(nearestEffort(["low", "medium", "high"], "medium")).toBe("medium");
  });

  it("lands on the closest level, taking the deeper one on a tie", () => {
    expect(nearestEffort(["low", "high"], "medium")).toBe("high");
    expect(nearestEffort(["low", "medium", "high"], "ultra")).toBe("high");
    expect(nearestEffort(["high", "max"], "low")).toBe("high");
  });

  it("is undefined when the agent decides for itself", () => {
    expect(nearestEffort([], "high")).toBeUndefined();
  });
});

describe("withinCapabilities", () => {
  it("moves settings onto what the new model actually takes", () => {
    const moved = withinCapabilities(
      {
        provider: "opencode" as const,
        model: "opencode/claude-haiku-4-5",
        effort: "low",
        access: "acceptEdits" as const,
      },
      catalogCapabilities(catalog, "opencode", "opencode/claude-haiku-4-5")
    );
    expect(moved.effort).toBe("high");
    expect(moved.access).toBe("supervised");
  });

  it("empties the effort when the model names no levels", () => {
    const moved = withinCapabilities(
      {
        provider: "cursor" as const,
        model: "composer-2.5",
        effort: "high",
        access: "fullAccess" as const,
      },
      catalogCapabilities(catalog, "cursor", "composer-2.5")
    );
    expect(moved.effort).toBe("");
  });

  it("leaves settings the agent can run with untouched", () => {
    const settings = {
      provider: "claude" as const,
      model: "opus",
      effort: "high",
      access: "fullAccess" as const,
    };
    expect(
      withinCapabilities(
        settings,
        catalogCapabilities(catalog, "claude", "opus")
      )
    ).toBe(settings);
  });
});
