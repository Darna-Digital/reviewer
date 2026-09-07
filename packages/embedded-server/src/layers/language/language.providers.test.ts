/**
 * What a repository's provider list is made of, and when it is made again.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { selectProvider } from "@reviewer/core/language";
import { providersFor, resetProviders } from "./language.providers.ts";

let root: string;

const writeConfig = (contents: string) => {
  mkdirSync(join(root, ".reviewer"), { recursive: true });
  writeFileSync(join(root, ".reviewer/languages.json"), contents);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reviewer-providers-"));
  resetProviders();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  resetProviders();
});

describe("providersFor", () => {
  it("gives every repository the built-in providers", () => {
    const ids = providersFor(root).providers.map((provider) => provider.id);
    expect(ids).toContain("typescript");
    expect(ids).toContain("lsp:ruby");
  });

  it("claims Ruby files for the Ruby provider, and .ts for TypeScript", () => {
    const { providers } = providersFor(root);
    expect(selectProvider(providers, "app/models/user.rb")?.id).toBe(
      "lsp:ruby"
    );
    expect(selectProvider(providers, "Gemfile")?.id).toBe("lsp:ruby");
    expect(selectProvider(providers, "src/main.ts")?.id).toBe("typescript");
    expect(selectProvider(providers, "notes.md")).toBeNull();
  });

  it("lets a repository shadow a built-in with its own server", () => {
    writeConfig(
      JSON.stringify({
        servers: [
          {
            id: "solargraph",
            name: "Solargraph",
            patterns: [".rb"],
            command: "solargraph",
          },
        ],
      })
    );
    const { providers } = providersFor(root);
    expect(selectProvider(providers, "app/models/user.rb")?.id).toBe(
      "lsp:solargraph"
    );
  });

  it("reports a malformed entry instead of dropping the file", () => {
    writeConfig(JSON.stringify({ servers: [{ id: "broken" }] }));
    const { providers, problems } = providersFor(root);
    expect(problems).toEqual([expect.stringContaining("command")]);
    expect(providers.map((provider) => provider.id)).toContain("typescript");
  });

  it("reuses a list within the detection window, and rebuilds after it", () => {
    const first = providersFor(root, 1_000);
    expect(providersFor(root, 2_000)).toBe(first);
    // A language server installed while the app is open is found without a
    // restart: nothing on disk changed, so only the clock can say to look.
    expect(providersFor(root, 60_000)).not.toBe(first);
  });

  it("rebuilds when the configuration file changes", () => {
    const first = providersFor(root, 1_000);
    writeConfig(
      JSON.stringify({
        servers: [
          { id: "gopls", name: "Go", patterns: [".go"], command: "gopls" },
        ],
      })
    );
    const second = providersFor(root, 1_100);
    expect(second).not.toBe(first);
    expect(second.providers.map((provider) => provider.id)).toContain(
      "lsp:gopls"
    );
  });
});
