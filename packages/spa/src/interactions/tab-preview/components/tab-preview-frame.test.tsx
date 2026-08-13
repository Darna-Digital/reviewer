// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TabPreviewFrame } from "./tab-preview-frame";
import {
  PREVIEW_INTENT_MS,
  PREVIEW_ZOOM,
} from "../functions/tab-preview.functions";

const TITLE = "Local changes preview";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

let box = 0;

const show = (href: string) =>
  render(
    <TabPreviewFrame
      target={{ href, title: "Local changes" }}
      zoom={PREVIEW_ZOOM}
      bootDelayMs={PREVIEW_INTENT_MS}
      // A key of its own per case: the warm list outlives a single render.
      cacheKey={`test:${(box += 1)}`}
    />
  );

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(PREVIEW_INTENT_MS);
  });

const frameFor = (href: string): HTMLIFrameElement => {
  show(href);
  settle();
  return screen.getByTitle(TITLE);
};

describe("TabPreviewFrame", () => {
  it("starts nothing for a box the pointer only passes over", () => {
    show("/modes/code/commit");

    expect(screen.queryByTitle(TITLE)).toBeNull();
  });

  it("loads the app's root, carrying the tab's location as the preview", () => {
    const src = new URL(frameFor("/modes/code/commit").src);

    expect(src.pathname).toBe("/");
    expect(src.searchParams.get("preview")).toBe("/modes/code/commit");
  });

  it("leaves the page to be looked at rather than used", () => {
    const frame = frameFor("/modes/code/commit");

    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(frame.tabIndex).toBe(-1);
  });

  it("draws a window wider than the box it is shown in", () => {
    const frame = frameFor("/modes/agent-session/abc");

    expect(parseFloat(frame.style.width)).toBeGreaterThan(100);
    expect(frame.style.transform).toBe(`scale(${PREVIEW_ZOOM})`);
  });
});
