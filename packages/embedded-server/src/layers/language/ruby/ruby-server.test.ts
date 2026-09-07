import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import {
  detectRubyServer,
  RUBY_PATTERNS,
  rubyProviderFor,
} from "./ruby-server.ts";

const ROOT = "/repo";

/** A machine: which commands are installed, and what the repository holds. */
const machine = (
  installed: ReadonlyArray<string>,
  files: Readonly<Record<string, string>> = {}
) => ({
  resolve: (command: string) =>
    installed.includes(command) ? `/usr/bin/${command}` : null,
  readText: (path: string) => files[path] ?? null,
});

const GEMFILE_LOCK = `GEM
  remote: https://rubygems.org/
  specs:
    rails (7.1.3)
    ruby-lsp (0.17.2)
    ruby-lsp-rails (0.3.6)

PLATFORMS
  ruby
`;

describe("detectRubyServer", () => {
  it("runs ruby-lsp through the bundle when the project declares it", () => {
    const { config, availability } = detectRubyServer(
      ROOT,
      machine(["bundle", "ruby-lsp"], { "/repo/Gemfile.lock": GEMFILE_LOCK })
    );
    expect(config.command).toBe("bundle");
    expect(config.args).toEqual(["exec", "ruby-lsp"]);
    expect(availability.available).toBe(true);
    expect(availability.detail).toContain("bundle");
  });

  it("reads the Gemfile when the lockfile is not committed", () => {
    const { config } = detectRubyServer(
      ROOT,
      machine(["bundle"], {
        "/repo/Gemfile": 'source "https://rubygems.org"\ngem "ruby-lsp"\n',
      })
    );
    expect(config.args).toEqual(["exec", "ruby-lsp"]);
  });

  it("does not reach for Bundler when Bundler is not installed", () => {
    const { config } = detectRubyServer(
      ROOT,
      machine(["ruby-lsp"], { "/repo/Gemfile.lock": GEMFILE_LOCK })
    );
    expect(config.command).toBe("ruby-lsp");
    expect(config.args).toEqual([]);
  });

  it("takes a globally installed ruby-lsp, which composes its own bundle", () => {
    const { config, availability } = detectRubyServer(
      ROOT,
      machine(["bundle", "ruby-lsp"])
    );
    expect(config.command).toBe("ruby-lsp");
    expect(availability.detail).toContain("/usr/bin/ruby-lsp");
  });

  it("falls back to solargraph, bundled first", () => {
    const bundled = detectRubyServer(
      ROOT,
      machine(["bundle", "solargraph"], {
        "/repo/Gemfile.lock": "    solargraph (0.50.0)\n",
      })
    );
    expect(bundled.config.args).toEqual(["exec", "solargraph", "stdio"]);

    const global = detectRubyServer(ROOT, machine(["solargraph"]));
    expect(global.config.command).toBe("solargraph");
    expect(global.config.args).toEqual(["stdio"]);
  });

  it("prefers ruby-lsp over an installed solargraph", () => {
    const { config } = detectRubyServer(
      ROOT,
      machine(["ruby-lsp", "solargraph"])
    );
    expect(config.command).toBe("ruby-lsp");
  });

  it("reports itself unavailable, with what to install, when there is none", () => {
    const { availability } = detectRubyServer(ROOT, machine([]));
    expect(availability.available).toBe(false);
    expect(availability.detail).toContain("gem install ruby-lsp");
  });

  it("does not mistake a gem whose name contains the one asked for", () => {
    const { config } = detectRubyServer(
      ROOT,
      machine(["bundle"], {
        "/repo/Gemfile.lock": "    ruby-lsp-rails (0.3.6)\n",
      })
    );
    expect(config.command).not.toBe("bundle");
  });
});

describe("the Ruby provider", () => {
  it("claims Ruby files, Rails views and the files with no extension", () => {
    expect(RUBY_PATTERNS).toContain(".rb");
    expect(RUBY_PATTERNS).toContain(".erb");
    expect(RUBY_PATTERNS).toContain("Gemfile");
  });

  it("is the generic LSP provider, and answers the probe from the search", async () => {
    const provider = rubyProviderFor(ROOT, machine(["ruby-lsp"]));
    expect(provider.id).toBe("lsp:ruby");
    expect(provider.transport).toBe("lsp-stdio");
    expect(provider.capabilities.definition).toBe(true);
    expect(provider.capabilities.references).toBe(true);
    expect(await Effect.runPromise(provider.probe(ROOT))).toEqual({
      available: true,
      detail: "ruby-lsp (/usr/bin/ruby-lsp)",
    });
  });

  it("stays quiet on a machine with no Ruby server rather than failing", async () => {
    const provider = rubyProviderFor(ROOT, machine([]));
    const request = { root: ROOT, path: "app/models/user.rb", contents: "" };
    expect(
      await Effect.runPromise(
        provider.definition({ ...request, position: { line: 0, character: 0 } })
      )
    ).toEqual({ providerId: null, origin: null, targets: [] });
    expect(await Effect.runPromise(provider.diagnostics(request))).toEqual([]);
  });
});
