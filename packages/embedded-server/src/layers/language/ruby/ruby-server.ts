/**
 * Ruby, and with it Rails, without anything to configure.
 *
 * `.reviewer/languages.json` can already point reviewer at any language server,
 * but Ruby is common enough — and the servers are conventional enough — that
 * asking every Rails repository to write the same six lines is a tax rather
 * than a feature. So the same generic LSP provider is built here from a server
 * found on the machine, and the file stays available for the projects that want
 * something else: a configured entry claiming `.rb` is listed first and wins.
 *
 * What gets picked, in order:
 *
 * 1. `bundle exec ruby-lsp`, when the bundle declares `ruby-lsp`. Running it
 *    through Bundler is what loads the project's own addons — `ruby-lsp-rails`
 *    is the one that knows what `has_many` and `belongs_to` define, which is
 *    the difference between "Ruby works" and "Rails works".
 * 2. `ruby-lsp` on PATH. The gem's own executable composes a bundle for the
 *    project (`.ruby-lsp/`) and pulls the Rails addon into it when the app has
 *    Rails, so a globally installed server is Rails-aware too.
 * 3. `bundle exec solargraph stdio`, then `solargraph stdio` — the older
 *    server, still what a good many repositories have installed.
 *
 * When none of them is there the provider is still registered, reporting itself
 * unavailable with what to install: "no Ruby language server" is a thing worth
 * being told once, and it keeps `.rb` files from silently looking like a
 * language reviewer has never heard of.
 */
import { readFileSync } from "node:fs";
import * as Effect from "effect/Effect";
import type {
  LanguageProvider,
  ProviderAvailability,
} from "@reviewer/core/ports/language-provider";
import type { LspServerConfig } from "../lsp/lsp-config.ts";
import { findExecutable } from "../lsp/lsp-executable.ts";
import { makeLspProvider } from "../lsp/lsp-provider.ts";

/** Id of the built-in entry; the provider itself is `lsp:ruby`. */
export const RUBY_SERVER_ID = "ruby";

/**
 * What the provider claims. The extensions are Ruby's, `Gemfile` and `Rakefile`
 * are Ruby files without one, and `.erb` is where half of a Rails app lives —
 * a server that does not understand a view template answers nothing for it,
 * which is what a file with no provider does anyway.
 */
export const RUBY_PATTERNS: ReadonlyArray<string> = [
  ".rb",
  ".rake",
  ".ru",
  ".gemspec",
  ".erb",
  "Gemfile",
  "Rakefile",
];

/** How to install one, said once, wherever the settings screen shows it. */
const INSTALL_HINT =
  "install one with `gem install ruby-lsp`, or add a server to .reviewer/languages.json";

export interface RubyLookupOptions {
  /** Contents of a file in the repository, or null when it is not there. */
  readonly readText?: (path: string) => string | null;
  /** Resolved path of a command on PATH, or null when it is not installed. */
  readonly resolve?: (command: string) => string | null;
}

export interface RubyServerChoice {
  readonly config: LspServerConfig;
  readonly availability: ProviderAvailability;
}

const readTextFile = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const configOf = (
  command: string,
  args: ReadonlyArray<string>
): LspServerConfig => ({
  id: RUBY_SERVER_ID,
  name: "Ruby",
  patterns: RUBY_PATTERNS,
  command,
  args,
  env: {},
  initializationOptions: null,
});

/**
 * Whether the project's bundle declares `gem`. The lockfile is the honest
 * answer — it lists what `bundle exec` will actually resolve, including gems
 * pulled in by a group — and the Gemfile is the fallback for a repository whose
 * lockfile is not committed.
 */
const bundleDeclares = (
  root: string,
  gem: string,
  readText: (path: string) => string | null
): boolean => {
  const base = root.replace(/\/+$/, "");
  const lock = readText(`${base}/Gemfile.lock`);
  if (lock !== null) {
    // Lockfile entries are indented and versioned: "    ruby-lsp (0.17.0)".
    if (new RegExp(String.raw`^\s+${gem} \(`, "m").test(lock)) return true;
  }
  const gemfile = readText(`${base}/Gemfile`);
  return (
    gemfile !== null &&
    new RegExp(String.raw`^\s*gem\s+["']${gem}["']`, "m").test(gemfile)
  );
};

/**
 * The Ruby server to run in `root`, and what to say about it. Both halves come
 * out of one pass so the settings screen names the server that would actually
 * be started rather than re-deriving it.
 */
export const detectRubyServer = (
  root: string,
  options: RubyLookupOptions = {}
): RubyServerChoice => {
  const { readText = readTextFile, resolve = findExecutable } = options;

  const bundler = resolve("bundle");
  const bundled = (gem: string) =>
    bundler !== null && bundleDeclares(root, gem, readText);

  const available = (
    config: LspServerConfig,
    detail: string
  ): RubyServerChoice => ({
    config,
    availability: { available: true, detail },
  });

  if (bundled("ruby-lsp")) {
    return available(
      configOf("bundle", ["exec", "ruby-lsp"]),
      `ruby-lsp, through the project's bundle (${bundler})`
    );
  }

  const rubyLsp = resolve("ruby-lsp");
  if (rubyLsp !== null) {
    return available(configOf("ruby-lsp", []), `ruby-lsp (${rubyLsp})`);
  }

  if (bundled("solargraph")) {
    return available(
      configOf("bundle", ["exec", "solargraph", "stdio"]),
      `solargraph, through the project's bundle (${bundler})`
    );
  }

  const solargraph = resolve("solargraph");
  if (solargraph !== null) {
    return available(
      configOf("solargraph", ["stdio"]),
      `solargraph (${solargraph})`
    );
  }

  // Nothing installed. The entry still describes what it would run, so a file
  // operation stays quiet (the provider checks for its binary before it speaks)
  // while the providers list explains itself.
  return {
    config: configOf("ruby-lsp", []),
    availability: {
      available: false,
      detail: `no Ruby language server found — ${INSTALL_HINT}`,
    },
  };
};

/**
 * The built-in Ruby provider for a repository. Everything but the probe is the
 * generic LSP provider; the probe answers from the search above, so the reason
 * a repository has no Ruby support is the reason it was actually given.
 */
export const rubyProviderFor = (
  root: string,
  options?: RubyLookupOptions
): LanguageProvider => {
  const { config, availability } = detectRubyServer(root, options);
  return {
    ...makeLspProvider(config, { findCommand: options?.resolve }),
    probe: () => Effect.succeed(availability),
  };
};
