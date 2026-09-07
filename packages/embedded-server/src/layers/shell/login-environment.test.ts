/**
 * Asking a real subprocess for an environment, the way the app asks the
 * developer's shell — a fake shell rather than a mock, so the arguments, the
 * marks and the parsing are all exercised.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadLoginEnvironment,
  loginEnvironment,
  parseEnvironment,
  resetLoginEnvironment,
} from "./login-environment.ts";

let directory: string;

/** A "shell" that ignores its arguments and prints what it is told to. */
const fakeShell = (body: string): string => {
  const path = join(directory, "shell");
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
};

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "reviewer-shell-"));
  resetLoginEnvironment();
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  resetLoginEnvironment();
});

describe("parseEnvironment", () => {
  it("reads the variables between the marks", () => {
    expect(
      parseEnvironment(
        "__REVIEWER_ENV__\nPATH=/a:/b\nHOME=/home/me\n__REVIEWER_ENV__\n"
      )
    ).toEqual({ PATH: "/a:/b", HOME: "/home/me" });
  });

  it("ignores whatever a startup file printed around them", () => {
    const parsed = parseEnvironment(
      [
        "Welcome to zsh!",
        "rbenv: version 3.3.6",
        "__REVIEWER_ENV__",
        "PATH=/shims",
        "__REVIEWER_ENV__",
        "have a nice day",
      ].join("\n")
    );
    expect(parsed).toEqual({ PATH: "/shims" });
  });

  it("keeps a value that spans lines, as `env` prints one", () => {
    expect(
      parseEnvironment(
        "__REVIEWER_ENV__\nA=one\nstill one\nB=two\n__REVIEWER_ENV__\n"
      )
    ).toEqual({ A: "one\nstill one", B: "two" });
  });

  it("answers with nothing when the marks never arrived", () => {
    expect(parseEnvironment("command not found: env\n")).toEqual({});
  });
});

describe("loadLoginEnvironment", () => {
  it("takes the shell's PATH over this process's", async () => {
    const shell = fakeShell(
      "printf '%s\\n' __REVIEWER_ENV__; printf 'PATH=/opt/shims:/usr/bin\\n'; printf '%s\\n' __REVIEWER_ENV__"
    );
    const environment = await loadLoginEnvironment(shell, "linux");
    expect(environment["PATH"]).toBe("/opt/shims:/usr/bin");
    // Everything the process already had is still there.
    expect(environment["HOME"]).toBe(process.env["HOME"]);
    expect(loginEnvironment()["PATH"]).toBe("/opt/shims:/usr/bin");
  });

  it("asks once, however many callers there are", async () => {
    const shell = fakeShell(
      "printf '%s\\n' __REVIEWER_ENV__; printf 'PATH=/first\\n'; printf 'RUNS=%s\\n' \"$(date +%s%N)\"; printf '%s\\n' __REVIEWER_ENV__"
    );
    const [one, two] = await Promise.all([
      loadLoginEnvironment(shell, "linux"),
      loadLoginEnvironment(shell, "linux"),
    ]);
    expect(one["RUNS"]).toBe(two["RUNS"]);
    expect(await loadLoginEnvironment(shell, "linux")).toBe(one);
  });

  it("keeps this process's environment when the shell fails", async () => {
    const shell = fakeShell("echo 'no' >&2; exit 1");
    const environment = await loadLoginEnvironment(shell, "linux");
    expect(environment["PATH"]).toBe(process.env["PATH"]);
  });

  it("does not go looking for a login shell on Windows", async () => {
    expect(await loadLoginEnvironment("C:/nope.exe", "win32")).toBe(
      process.env
    );
  });

  it("falls back to this process's environment with no shell to ask", async () => {
    // `$SHELL` unset, which is how a stripped-down container arrives.
    expect(await loadLoginEnvironment("", "linux")).toBe(process.env);
  });
});
