import { describe, expect, it } from "vitest";
import {
  buildAnalysisPrompt,
  buildAnalysisTitle,
  modePrompt,
  modeTitle,
} from "./chat-mode.functions";

describe("buildAnalysisTitle", () => {
  it("capitalises the question and collapses its whitespace", () => {
    expect(
      buildAnalysisTitle("  analyse how a\n new branch  is created ")
    ).toBe("Analyse how a new branch is created");
  });

  it("clips a long question rather than letting it run", () => {
    const title = buildAnalysisTitle("x".repeat(200));
    expect(title).toHaveLength(61);
    expect(title.endsWith("…")).toBe(true);
  });

  it("has something to show for an empty question", () => {
    expect(buildAnalysisTitle("   ")).toBe("Analysis");
  });
});

describe("buildAnalysisPrompt", () => {
  const prompt = buildAnalysisPrompt("  how is a branch created?  ");

  it("carries the question and tells the agent where to put the result", () => {
    expect(prompt).toContain("how is a branch created?");
    expect(prompt).toContain("/api/plans");
    expect(prompt).toContain("anchor");
  });

  it("asks for a multi-point note as a numbered list", () => {
    expect(prompt).toContain("numbered list");
  });
});

describe("what each mode sends", () => {
  it("leaves a build prompt exactly as it was typed", () => {
    expect(modePrompt("build", "  fix the crash  ")).toBe("  fix the crash  ");
  });

  it("wraps an analysis prompt in the instructions for the pane", () => {
    expect(modePrompt("analysis", "how is a branch created?")).toContain(
      "/api/plans"
    );
  });

  it("names an analysis session, and lets the server name a build one", () => {
    expect(modeTitle("analysis", "how is a branch created?")).toBe(
      "How is a branch created?"
    );
    expect(modeTitle("build", "fix the crash")).toBeNull();
  });
});
