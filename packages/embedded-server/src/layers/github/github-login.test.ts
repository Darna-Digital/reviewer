import { describe, expect, it } from "vitest";
import { parseLoginOutput } from "./github-login.ts";

describe("parseLoginOutput", () => {
  it("reads the code and the device page off the CLI's prompt", () => {
    const output =
      "! First copy your one-time code: 1A2B-3C4D\n" +
      "Open this URL to continue in your web browser: https://github.com/login/device\n";

    expect(parseLoginOutput(output)).toEqual({
      code: "1A2B-3C4D",
      url: "https://github.com/login/device",
    });
  });

  it("sees through colour codes and falls back to the known page", () => {
    const output =
      "\x1b[33m!\x1b[0m First copy your one-time code: \x1b[1mWXYZ-0123\x1b[0m\n";

    expect(parseLoginOutput(output)).toEqual({
      code: "WXYZ-0123",
      url: "https://github.com/login/device",
    });
  });

  it("has nothing until the code has been printed", () => {
    expect(parseLoginOutput("Logging into github.com\n")).toBeNull();
  });
});
