// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  capturePreviewPage,
  capturePreviewStyles,
} from "./preview-capture.functions";

const ROOT = "#page";

const styled = (css: string) => {
  document.head.innerHTML = `<style>${css}</style>`;
  return capturePreviewStyles(window);
};

const page = (html: string) => {
  document.body.innerHTML = `<div id="page">${html}</div>`;
  return capturePreviewPage(window, ROOT);
};

beforeEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("the rules a picture is drawn with", () => {
  it("stands attributes in for the elements a shadow tree has not got", () => {
    const css = styled(":root{--a:1}body{margin:0}html.dark .x{color:red}");

    expect(css).toContain("[data-snapshot-html]{");
    expect(css).toContain("[data-snapshot-body]{");
    expect(css).toContain("[data-snapshot-html].dark .x{");
  });

  it("leaves a selector that only reads like a root alone", () => {
    expect(styled(".bodyguard{color:red}")).toContain(".bodyguard{");
  });

  it("resolves viewport units against the window the page was rendered in", () => {
    const css = styled(".a{height:50svh}");

    expect(css).toContain(`height: ${window.innerHeight / 2}px`);
    expect(css).not.toContain("svh");
  });

  it("answers media conditions here rather than carrying them to the card", () => {
    const css = styled("@media (min-width: 99999px){.a{color:red}}");

    expect(css).not.toContain("@media");
  });

  it("leaves the fonts to the window the cards are shown in", () => {
    expect(styled("@font-face{font-family:X;src:url(x.woff2)}")).toBe("");
  });
});

describe("the markup a picture is made of", () => {
  it("copies the page it was pointed at", () => {
    expect(page("<p>hello</p>")?.html).toContain("<p>hello</p>");
  });

  it("has nothing to say about a page that is not there", () => {
    document.body.innerHTML = "";

    expect(capturePreviewPage(window, ROOT)).toBeNull();
  });

  it("drops everything whose only job is to load or run something", () => {
    const captured = page(
      "<p>hi</p><script>window.x = 1</script><style>i{}</style>"
    );

    expect(captured?.html).not.toContain("window.x");
    expect(captured?.html).not.toContain("<style>");
  });

  it("carries what a field has been typed into, which no clone would", () => {
    document.body.innerHTML = `<div id="page"><input></div>`;
    const field = document.querySelector("input");
    if (field !== null) field.value = "typed";

    expect(capturePreviewPage(window, ROOT)?.html).toContain('value="typed"');
  });

  it("sends a shadow tree as the markup that builds one back", () => {
    document.body.innerHTML = `<div id="page"><x-thing></x-thing></div>`;
    const host = document.querySelector("x-thing");
    host
      ?.attachShadow({ mode: "open" })
      .append(
        Object.assign(document.createElement("span"), { textContent: "inside" })
      );

    const captured = capturePreviewPage(window, ROOT);

    expect(captured?.html).toContain('<template shadowrootmode="open">');
    expect(captured?.html).toContain("inside");
  });

  it("keeps the window's own attributes, which carry the theme", () => {
    document.documentElement.className = "dark";
    document.body.setAttribute("data-mode", "code");

    const captured = page("<p>hi</p>");

    expect(captured?.rootAttrs["class"]).toBe("dark");
    expect(captured?.bodyAttrs["data-mode"]).toBe("code");
  });
});
