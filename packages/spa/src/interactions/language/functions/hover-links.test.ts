import { describe, expect, it } from "vitest";
import { hoverLinkLocation } from "./hover-links";

describe("hoverLinkLocation", () => {
  it("reads the file and the line a link points at", () => {
    // ruby-lsp writes the range as `#L<line>,<col>-<line>,<col>`.
    expect(hoverLinkLocation("app/models/current.rb#L1,1-11,4")).toEqual({
      path: "app/models/current.rb",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    });
    expect(
      hoverLinkLocation("app/models/current.rb#L12")?.range.start.line
    ).toBe(11);
  });

  it("opens the top of the file when the link names no line", () => {
    expect(hoverLinkLocation("lib/tasks/db.rake")).toEqual({
      path: "lib/tasks/db.rake",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    });
  });

  it("leaves anything that is not a file in this project alone", () => {
    // Documentation links, and a definition inside a gem the server could not
    // name from the repository.
    expect(hoverLinkLocation("https://api.rubyonrails.org/x.html")).toBeNull();
    expect(
      hoverLinkLocation("file:///opt/gems/activerecord/base.rb")
    ).toBeNull();
    expect(hoverLinkLocation("#section")).toBeNull();
    expect(hoverLinkLocation("")).toBeNull();
    expect(hoverLinkLocation(undefined)).toBeNull();
  });
});
