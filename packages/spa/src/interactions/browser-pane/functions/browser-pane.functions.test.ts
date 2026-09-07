// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  captureRect,
  displayUrl,
  elementLabel,
  elementPickerScript,
  normalizeUrl,
  uniqueSelector,
} from "./browser-pane.functions";
import type { PickedElement } from "../interfaces/browser-pane.interfaces";

describe("normalizeUrl", () => {
  it("keeps a web URL as typed", () => {
    expect(normalizeUrl("https://example.com/a?b=1")).toBe(
      "https://example.com/a?b=1"
    );
    expect(normalizeUrl("  http://localhost:5173  ")).toBe(
      "http://localhost:5173"
    );
  });

  it("reads a bare host or host:port as http", () => {
    expect(normalizeUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeUrl("example.com/path")).toBe("http://example.com/path");
    expect(normalizeUrl("127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
  });

  it("refuses anything that is not the web", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeUrl("data:text/html,x")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
  });
});

describe("displayUrl", () => {
  it("drops the scheme and a bare trailing slash", () => {
    expect(displayUrl("http://localhost:3000/")).toBe("localhost:3000");
    expect(displayUrl("https://example.com/a")).toBe("example.com/a");
  });
});

const mount = (html: string): Document => {
  document.body.innerHTML = html;
  return document;
};

describe("uniqueSelector", () => {
  it("prefers an id when it identifies the element on its own", () => {
    const doc = mount(`<div><button id="save">Save</button></div>`);
    expect(uniqueSelector(doc.querySelector("#save")!)).toBe("#save");
  });

  it("falls back to a test id, then a name", () => {
    const doc = mount(
      `<form><input data-testid="email" /><input name="pass" /></form>`
    );
    expect(uniqueSelector(doc.querySelector("[data-testid]")!)).toBe(
      '[data-testid="email"]'
    );
    expect(uniqueSelector(doc.querySelector("[name]")!)).toBe(
      'input[name="pass"]'
    );
  });

  it("walks up with nth-of-type when nothing identifies the element", () => {
    const doc = mount(`<ul id="list"><li>a</li><li>b</li><li>c</li></ul>`);
    const selector = uniqueSelector(doc.querySelectorAll("li")[1]);
    expect(selector).toBe("#list > li:nth-of-type(2)");
    expect(doc.querySelectorAll(selector)).toHaveLength(1);
  });

  it("omits nth-of-type for an only child of its tag", () => {
    const doc = mount(`<section id="s"><p>only</p><span>x</span></section>`);
    expect(uniqueSelector(doc.querySelector("p")!)).toBe("#s > p");
  });

  it("produces a selector that resolves back to the element it described", () => {
    const doc = mount(
      `<main><div class="row"><span>one</span></div>
       <div class="row"><span>two</span></div></main>`
    );
    const target = doc.querySelectorAll("span")[1];
    expect(doc.querySelector(uniqueSelector(target))).toBe(target);
  });
});

describe("elementLabel", () => {
  it("names the element by tag, id and its text", () => {
    const doc = mount(`<button id="go">  Save   changes </button>`);
    expect(elementLabel(doc.querySelector("button")!)).toBe(
      'button#go "Save changes"'
    );
  });

  it("clips long text and drops the quotes when there is none", () => {
    const doc = mount(`<p>${"x".repeat(80)}</p><hr />`);
    expect(elementLabel(doc.querySelector("p")!)).toBe(
      `p "${"x".repeat(60)}…"`
    );
    expect(elementLabel(doc.querySelector("hr")!)).toBe("hr");
  });
});

describe("elementPickerScript", () => {
  it("carries the selector and label helpers into the guest", () => {
    const script = elementPickerScript();
    expect(script).toContain("nth-of-type");
    expect(script).toContain("__reviewerCancelPick");
    // The helpers are stringified, so they must not close over module scope.
    expect(script).not.toMatch(/\bimport\b|\bexports\./);
  });
});

const picked = (rect: PickedElement["rect"]): PickedElement => ({
  selector: "#a",
  label: "div",
  rect,
  url: "http://localhost:3000/",
  viewport: { width: 800, height: 600 },
});

describe("captureRect", () => {
  it("rounds outward to whole pixels", () => {
    expect(
      captureRect(picked({ x: 10.4, y: 20.6, width: 30.2, height: 5.1 }))
    ).toEqual({ x: 10, y: 20, width: 31, height: 6 });
  });

  it("clamps to the viewport", () => {
    expect(
      captureRect(picked({ x: -20, y: 580, width: 1000, height: 100 }))
    ).toEqual({ x: 0, y: 580, width: 800, height: 20 });
  });

  it("has nothing to capture for an element scrolled out of view", () => {
    expect(
      captureRect(picked({ x: 0, y: 900, width: 100, height: 50 }))
    ).toBeNull();
    expect(captureRect(picked({ x: 0, y: 0, width: 0, height: 0 }))).toBeNull();
  });
});
