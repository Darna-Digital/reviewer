// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  captureOrder,
  snapshotOf,
  SNAPSHOT_MAX_CHARS,
  withBase,
} from "./tab-snapshot.functions";

const ROOT = "http://localhost:41812/";

const documentOf = (body: string, head = ""): Document => {
  const parsed = new DOMParser().parseFromString(
    `<!doctype html><html><head>${head}</head><body>${body}</body></html>`,
    "text/html"
  );
  return parsed;
};

describe("withBase", () => {
  it("resolves the page's own assets against the app it came from", () => {
    expect(withBase("<html><head><title>a</title></head></html>", ROOT)).toBe(
      `<html><head><base href="${ROOT}"><title>a</title></head></html>`
    );
  });

  it("keeps a quoted base out of the attribute it is written into", () => {
    expect(withBase("<head></head>", 'http://x/"onload="evil')).toContain(
      "&quot;onload=&quot;"
    );
  });

  it("still leads with the base when the page has no head to put it in", () => {
    expect(withBase("<html><body>a</body></html>", ROOT)).toMatch(/^<base/);
  });
});

describe("snapshotOf", () => {
  it("keeps the markup as a document a frame can render on its own", () => {
    const html = snapshotOf(documentOf("<p>hello</p>"), ROOT);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<p>hello</p>");
    expect(html).toContain(`<base href="${ROOT}">`);
  });

  it("drops the scripts, which no snapshot frame would run anyway", () => {
    const html = snapshotOf(
      documentOf("<p>hi</p><script>window.x = 1</script>"),
      ROOT
    );

    expect(html).not.toContain("window.x");
  });

  it("drops the loading hints, which point at work already done", () => {
    const html = snapshotOf(
      documentOf("<p>hi</p>", '<link rel="modulepreload" href="/entry.js">'),
      ROOT
    );

    expect(html).not.toContain("modulepreload");
  });

  it("keeps the stylesheet the page is drawn with", () => {
    const html = snapshotOf(
      documentOf("<p>hi</p>", '<link rel="stylesheet" href="/styles.css">'),
      ROOT
    );

    expect(html).toContain("styles.css");
  });

  it("refuses a page too large to be worth holding a picture of", () => {
    const huge = documentOf(`<p>${"x".repeat(SNAPSHOT_MAX_CHARS)}</p>`);

    expect(snapshotOf(huge, ROOT)).toBeNull();
  });
});

describe("captureOrder", () => {
  it("starts at the tab being looked at and comes back round to the rest", () => {
    expect(captureOrder(["a", "b", "c", "d"], 2)).toEqual(["c", "d", "a", "b"]);
  });

  it("starts at the beginning when nothing is active", () => {
    expect(captureOrder(["a", "b"], -1)).toEqual(["a", "b"]);
  });

  it("has nothing to do with no tabs open", () => {
    expect(captureOrder([], 0)).toEqual([]);
  });
});
