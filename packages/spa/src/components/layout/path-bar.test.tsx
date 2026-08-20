// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PathBar } from "@/components/layout/path-bar";

afterEach(cleanup);

const crumbs = [{ id: "review-mode", label: "Pull requests" }];

describe("PathBar", () => {
  /**
   * Over a diff the trail is the only thing naming the open file — the
   * open-file strip is browsing's and is not drawn there — so it also has to be
   * the way back to the diff.
   */
  it("ends the line with a close control when one is given", async () => {
    const onClose = vi.fn();
    render(
      <PathBar
        crumbs={crumbs}
        path="src/app.ts"
        paths={["src/app.ts"]}
        onOpenFile={vi.fn()}
        onClose={onClose}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Close file" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Browsing has no diff under the file to go back to; there the strip is what
  // puts a file down.
  it("has none where nothing asked for one", () => {
    render(
      <PathBar
        crumbs={crumbs}
        path="src/app.ts"
        paths={["src/app.ts"]}
        onOpenFile={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Close file" })).toBeNull();
  });
});
