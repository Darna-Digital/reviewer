// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { TabPreviewFrame } from "./tab-preview-frame";
import { putSnapshot } from "../adapters/tab-snapshots.store";
import type { PreviewCapture } from "../functions/preview-capture.functions";

const CARD_WIDTH = 320;

/** jsdom lays nothing out; the card measures its box to know what to scale to. */
beforeAll(() => {
  window.ResizeObserver = class {
    constructor(private readonly report: ResizeObserverCallback) {}
    observe() {
      this.report(
        [{ contentRect: { width: CARD_WIDTH } } as ResizeObserverEntry],
        this
      );
    }
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

let unique = 0;
const href = () => `/modes/code/commit?case=${(unique += 1)}`;

const capture = (patch: Partial<PreviewCapture> = {}): PreviewCapture => ({
  html: "<div>captured</div>",
  shadowSheets: {},
  rootAttrs: { class: "dark" },
  bodyAttrs: {},
  width: 1280,
  height: 800,
  ...patch,
});

const show = (at: string) =>
  render(<TabPreviewFrame target={{ href: at, title: "Local changes" }} />);

const hostFor = (at: string, patch?: Partial<PreviewCapture>) => {
  putSnapshot(at, capture(patch), 0);
  const { container } = show(at);
  const host = container.querySelector<HTMLElement>("[inert]");
  if (host === null) throw new Error("no host");
  return host;
};

describe("TabPreviewFrame", () => {
  it("shows the section's name until there is a picture of it", () => {
    show(href());

    expect(screen.getByText("Local changes")).toBeTruthy();
  });

  it("hangs the picture in a shadow root rather than a document of its own", () => {
    const host = hostFor(href());

    expect(host.shadowRoot).not.toBeNull();
    expect(host.querySelector("iframe")).toBeNull();
  });

  it("scales the window it was rendered in down into the card", () => {
    const host = hostFor(href());

    expect(host.style.width).toBe("1280px");
    expect(host.style.transform).toBe(`scale(${CARD_WIDTH / 1280})`);
    expect(host.style.transformOrigin).toBe("top left");
  });

  it("leaves the page to be looked at rather than used", () => {
    const host = hostFor(href());

    expect(host.getAttribute("aria-hidden")).toBe("true");
    expect(host.hasAttribute("inert")).toBe(true);
  });

  it("keeps a page rendered at another size in its own proportions", () => {
    const at = href();
    putSnapshot(at, capture({ width: 1000, height: 1000 }), 0);
    const { container } = show(at);

    expect(container.firstElementChild).toHaveProperty(
      "style.aspectRatio",
      "1000 / 1000"
    );
  });
});
