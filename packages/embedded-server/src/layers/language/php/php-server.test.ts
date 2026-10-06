import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import {
  detectPhpServer,
  INTELEPHENSE_SETTINGS,
  phpProviderFor,
} from "./php-server.ts";

/** A machine: which commands are on PATH, and whether reviewer installed one. */
const machine = (
  installed: ReadonlyArray<string>,
  managed: string | null = null
) => ({
  resolve: (command: string) =>
    installed.includes(command)
      ? `/usr/bin/${command}`
      : command.startsWith("/")
        ? command
        : null,
  managed: () => managed,
  node: "/app/node",
});

describe("detectPhpServer", () => {
  it("prefers the developer's own intelephense, tuned for Laravel", () => {
    const { config, availability } = detectPhpServer(
      machine(["intelephense", "phpactor"], "/managed/intelephense.js")
    );
    expect(config.command).toBe("intelephense");
    expect(config.args).toEqual(["--stdio"]);
    expect(config.settings).toBe(INTELEPHENSE_SETTINGS);
    expect(availability).toEqual({
      available: true,
      detail: "intelephense (/usr/bin/intelephense)",
    });
  });

  it("runs reviewer's own install on the server's Node", () => {
    const { config, availability } = detectPhpServer(
      machine(["phpactor"], "/managed/intelephense.js")
    );
    expect(config.command).toBe("/app/node");
    expect(config.args).toEqual(["/managed/intelephense.js", "--stdio"]);
    expect(availability.detail).toContain("installed by reviewer");
  });

  it("falls back to phpactor", () => {
    const { config } = detectPhpServer(machine(["phpactor"]));
    expect(config.command).toBe("phpactor");
    expect(config.args).toEqual(["language-server"]);
    expect(config.settings).toBeNull();
  });

  it("offers to install intelephense when there is nothing", () => {
    const { availability } = detectPhpServer(machine([]));
    expect(availability.available).toBe(false);
    expect(availability.detail).toContain("no PHP language server found");
    expect(availability.installer).toMatchObject({
      title: "Install intelephense",
      state: "ready",
      failure: null,
    });
  });
});

describe("phpProviderFor", () => {
  const files = {
    exists: (path: string) =>
      [
        "/repo/backend/artisan",
        "/repo/backend/resources/views/users/index.blade.php",
      ].includes(path),
    readText: (path: string) =>
      path === "/repo/backend/app/Http/Controllers/UserController.php"
        ? "<?php\nreturn view('users.index');\n"
        : path.endsWith(".blade.php")
          ? "<h1>Users</h1>"
          : null,
  };

  it("answers a Laravel reference without a language server", async () => {
    const provider = phpProviderFor("/repo", { ...machine([]), files });
    const result = await Effect.runPromise(
      provider.definition({
        root: "/repo",
        path: "backend/app/Http/Controllers/UserController.php",
        contents: null,
        position: { line: 1, character: 16 },
      })
    );
    expect(result.origin).toEqual({
      start: { line: 1, character: 13 },
      end: { line: 1, character: 24 },
    });
    expect(result.targets.map((target) => target.location.path)).toEqual([
      "backend/resources/views/users/index.blade.php",
    ]);
    expect(result.targets[0]?.preview).toBe("<h1>Users</h1>");
  });

  it("starts the install only when there is nothing installed", async () => {
    let started = 0;
    const install = () => {
      started += 1;
      return Promise.resolve();
    };
    await Effect.runPromise(
      phpProviderFor("/repo", { ...machine([]), files, install }).install!()
    );
    expect(started).toBe(1);
    const refused = await Effect.runPromise(
      Effect.flip(
        phpProviderFor("/repo", {
          ...machine(["intelephense"]),
          files,
          install,
        }).install!()
      )
    );
    expect(refused.reason).toContain("already installed");
    expect(started).toBe(1);
  });
});
