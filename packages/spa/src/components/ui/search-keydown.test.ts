// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  focusEdgeMenuRow,
  handleSearchKeyDown,
  handleSearchRowKeyDown,
  topLevelMenuRows,
} from "./search-keydown";

function menuFixture() {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-slot="dropdown-menu-content">
      <div data-slot="dropdown-menu-sub-trigger">Actions</div>
      <div data-slot="dropdown-menu-item">main</div>
      <div data-slot="dropdown-menu-item" data-disabled="">ignored</div>
      <div data-slot="dropdown-menu-sub-content">
        <div data-slot="dropdown-menu-item">nested-only</div>
      </div>
      <div data-slot="dropdown-menu-item">feature</div>
    </div>
  `;
  document.body.appendChild(root);
  const menu = root.querySelector<HTMLElement>(
    '[data-slot="dropdown-menu-content"]'
  )!;
  return { root, menu };
}

function popoverFixture() {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-slot="popover-content">
      <input data-search-input />
      <button type="button" data-search-row>reviewer</button>
      <button type="button" data-search-row>web-app</button>
      <button type="button" data-search-row>Browse folders</button>
    </div>
  `;
  document.body.appendChild(root);
  const panel = root.querySelector<HTMLElement>(
    '[data-slot="popover-content"]'
  )!;
  const rows = topLevelMenuRows(panel);
  const search = panel.querySelector<HTMLElement>("[data-search-input]")!;
  return { root, panel, rows, search };
}

function event(key: string, currentTarget: HTMLElement) {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget,
    target: currentTarget,
  };
}

describe("topLevelMenuRows", () => {
  it("returns enabled rows in this popup, not nested submenu items", () => {
    const { root, menu } = menuFixture();
    expect(topLevelMenuRows(menu).map((el) => el.textContent)).toEqual([
      "Actions",
      "main",
      "feature",
    ]);
    root.remove();
  });

  it("treats data-search-row elements in a popover as rows", () => {
    const { root, rows } = popoverFixture();
    expect(rows.map((el) => el.textContent)).toEqual([
      "reviewer",
      "web-app",
      "Browse folders",
    ]);
    root.remove();
  });
});

describe("focusEdgeMenuRow", () => {
  it("focuses the first or last top-level row", () => {
    const { root, menu } = menuFixture();
    const rows = topLevelMenuRows(menu);
    for (const row of rows) row.tabIndex = 0;

    focusEdgeMenuRow(menu, "first");
    expect(document.activeElement).toBe(rows[0]);

    focusEdgeMenuRow(menu, "last");
    expect(document.activeElement).toBe(rows[rows.length - 1]);

    root.remove();
  });
});

describe("handleSearchKeyDown", () => {
  it("lets Escape through without stopping propagation", () => {
    const input = document.createElement("input");
    const e = event("Escape", input);
    handleSearchKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });

  it("stops propagation for typing keys so the menu typeahead stays quiet", () => {
    const input = document.createElement("input");
    const e = event("m", input);
    handleSearchKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalledOnce();
  });

  it("moves focus to the first menu row on ArrowDown", () => {
    const { root, menu } = menuFixture();
    const rows = topLevelMenuRows(menu);
    for (const row of rows) row.tabIndex = 0;

    const input = document.createElement("input");
    menu.prepend(input);
    const e = event("ArrowDown", input);
    handleSearchKeyDown(e);

    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(e.stopPropagation).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(rows[0]);
    root.remove();
  });

  it("moves focus to the last menu row on ArrowUp", () => {
    const { root, menu } = menuFixture();
    const rows = topLevelMenuRows(menu);
    for (const row of rows) row.tabIndex = 0;

    const input = document.createElement("input");
    menu.prepend(input);
    const e = event("ArrowUp", input);
    handleSearchKeyDown(e);

    expect(e.preventDefault).toHaveBeenCalledOnce();
    expect(e.stopPropagation).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(rows[rows.length - 1]);
    root.remove();
  });

  it("reaches the first row of a popover panel too", () => {
    const { root, rows, search } = popoverFixture();
    handleSearchKeyDown(event("ArrowDown", search));
    expect(document.activeElement).toBe(rows[0]);
    root.remove();
  });
});

describe("handleSearchRowKeyDown", () => {
  it("walks down the rows and wraps at the end", () => {
    const { root, rows } = popoverFixture();

    handleSearchRowKeyDown(event("ArrowDown", rows[0]));
    expect(document.activeElement).toBe(rows[1]);

    handleSearchRowKeyDown(event("ArrowDown", rows[rows.length - 1]));
    expect(document.activeElement).toBe(rows[0]);

    root.remove();
  });

  it("returns to the search box when arrowing up off the first row", () => {
    const { root, rows, search } = popoverFixture();

    handleSearchRowKeyDown(event("ArrowUp", rows[1]));
    expect(document.activeElement).toBe(rows[0]);

    handleSearchRowKeyDown(event("ArrowUp", rows[0]));
    expect(document.activeElement).toBe(search);

    root.remove();
  });

  it("jumps to the edges on Home and End", () => {
    const { root, rows } = popoverFixture();

    handleSearchRowKeyDown(event("End", rows[0]));
    expect(document.activeElement).toBe(rows[rows.length - 1]);

    handleSearchRowKeyDown(event("Home", rows[rows.length - 1]));
    expect(document.activeElement).toBe(rows[0]);

    root.remove();
  });

  it("ignores keys that are not navigation", () => {
    const { root, rows } = popoverFixture();
    const e = event("Enter", rows[0]);
    handleSearchRowKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    root.remove();
  });
});
