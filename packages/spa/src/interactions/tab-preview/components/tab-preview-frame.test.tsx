// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TabPreviewFrame } from "./tab-preview-frame";
import { putSnapshot } from "../adapters/tab-snapshots.store";
import { PREVIEW_ZOOM } from "../functions/tab-preview.functions";

const TITLE = "Local changes preview";

afterEach(cleanup);

let unique = 0;
const href = () => `/modes/code/commit?case=${(unique += 1)}`;

const show = (at: string) =>
  render(
    <TabPreviewFrame
      target={{ href: at, title: "Local changes" }}
      zoom={PREVIEW_ZOOM}
    />
  );

const frameFor = (
  at: string,
  html = "<!doctype html><p>hi</p>"
): HTMLIFrameElement => {
  putSnapshot(at, html, 0);
  show(at);
  const frame = screen.getByTitle(TITLE);
  if (!(frame instanceof HTMLIFrameElement)) throw new Error("not a frame");
  return frame;
};

describe("TabPreviewFrame", () => {
  it("shows the tab's name until there is a picture of it", () => {
    const at = href();
    show(at);

    expect(screen.queryByTitle(TITLE)).toBeNull();
    expect(screen.getByText("Local changes")).toBeTruthy();
  });

  it("draws the picture it was given rather than loading the page again", () => {
    const frame = frameFor(href(), "<!doctype html><p>captured</p>");

    expect(frame.getAttribute("src")).toBeNull();
    expect(frame.srcdoc).toContain("captured");
  });

  it("lets nothing in the picture run", () => {
    const frame = frameFor(href());

    expect(frame.getAttribute("sandbox")).toBe("allow-same-origin");
  });

  it("leaves the page to be looked at rather than used", () => {
    const frame = frameFor(href());

    expect(frame.getAttribute("aria-hidden")).toBe("true");
    expect(frame.tabIndex).toBe(-1);
  });

  it("draws a window wider than the box it is shown in", () => {
    const frame = frameFor(href());

    expect(parseFloat(frame.style.width)).toBeGreaterThan(100);
    expect(frame.style.transform).toBe(`scale(${PREVIEW_ZOOM})`);
  });
});
