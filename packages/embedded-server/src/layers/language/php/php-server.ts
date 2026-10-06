/**
 * PHP, and with it Laravel, without anything to configure.
 *
 * Three things make a Laravel app read well, and this puts them together
 * behind the one provider that claims `.php`:
 *
 * 1. A PHP language server for the language itself — definitions, usages,
 *    hover, completions, the parser's diagnostics. Intelephense is the one
 *    worth having: it indexes `vendor/` too, so a click on a framework class
 *    lands in the framework, and Laravel's own docblocks (`@mixin`, generics,
 *    the facades' `@method static`) make most of Eloquent legible to it.
 * 2. Laravel's string references — `view('…')`, `config('…')`, `<x-…>` — which
 *    no PHP server follows; see `laravel-links.ts`.
 * 3. PHPStan's analysis, when the app runs it — the type errors Larastan finds
 *    behind Eloquent's magic; see `phpstan.ts`.
 *
 * The server picked, in order:
 *
 * 1. `intelephense` on PATH — the developer's own, which they keep current.
 * 2. The copy reviewer installed when asked (`intelephense-install.ts`), run on
 *    the server's own Node.
 * 3. `phpactor language-server` on PATH — open source, and what some PHP
 *    developers have instead.
 *
 * When none is there the provider still claims PHP, reporting itself
 * unavailable with an installer offered — the Laravel links still work, since
 * they need no server — and a configured entry in `.reviewer/languages.json`
 * claiming `.php` comes first and wins, as for every built-in.
 */
import { existsSync, readFileSync } from "node:fs";
import * as Effect from "effect/Effect";
import {
  LanguageError,
  type LanguageProvider,
  type ProviderAvailability,
} from "@reviewer/core/ports/language-provider";
import {
  previewAt,
  type DefinitionResult,
  type Diagnostic,
} from "@reviewer/core/language";
import type { LspServerConfig } from "../lsp/lsp-config.ts";
import { findExecutable } from "../lsp/lsp-executable.ts";
import { makeLspProvider } from "../lsp/lsp-provider.ts";
import { toAbsolute, toRepoRelative } from "../typescript/ts-mapping.ts";
import {
  installIntelephense,
  intelephenseInstaller,
  managedIntelephense,
} from "./intelephense-install.ts";
import {
  laravelAppRoot,
  laravelReferenceAt,
  laravelTargets,
  type LaravelFiles,
} from "./laravel-links.ts";
import { phpstanDiagnostics, phpstanFor } from "./phpstan.ts";

/** Id of the built-in entry; the provider itself is `lsp:php`. */
export const PHP_SERVER_ID = "php";

/**
 * `.php` covers Blade too — a view is `name.blade.php` — which is right: the
 * Laravel links matter most in views, and intelephense reads a template's
 * embedded PHP while leaving its markup alone.
 */
export const PHP_PATTERNS: ReadonlyArray<string> = [".php", ".phtml"];

const INSTALL_HINT =
  "install intelephense from here, with `npm install -g intelephense`, or add a server to .reviewer/languages.json";

/**
 * Intelephense's defaults, plus what a Laravel app needs. Its exclusions are
 * replaced rather than extended by this setting, so its own list is repeated.
 *
 * - `storage/framework` holds compiled Blade views, and `bootstrap/cache` the
 *   cached config and routes: PHP copies of code that lives elsewhere, which
 *   would otherwise turn up as a second definition of everything.
 * - The size cap goes from 1 MB to 3 MB because Laravel IDE Helper's
 *   `_ide_helper.php` — the stubs that teach a server the facades and each
 *   model's columns — outgrows the default in any sizeable app.
 * - Telemetry is off: reviewer starts this server, and is not going to opt the
 *   user in to reporting on their behalf.
 */
export const INTELEPHENSE_SETTINGS = {
  intelephense: {
    telemetry: { enabled: false },
    files: {
      maxSize: 3_000_000,
      exclude: [
        "**/.git/**",
        "**/.svn/**",
        "**/.hg/**",
        "**/CVS/**",
        "**/.DS_Store/**",
        "**/node_modules/**",
        "**/bower_components/**",
        "**/vendor/**/{Tests,tests}/**",
        "**/.history/**",
        "**/vendor/**/vendor/**",
        "**/storage/framework/**",
        "**/bootstrap/cache/**",
      ],
    },
  },
} as const;

/**
 * How long the diagnostics endpoint waits for PHPStan before answering with
 * the language server's alone. A first run on a large app takes far longer;
 * it carries on, and the next look at the file gets its findings from cache.
 */
const PHPSTAN_PATIENCE_MS = 8_000;

export interface PhpLookupOptions {
  /** Resolved path of a command on PATH, or null when it is not installed. */
  readonly resolve?: (command: string) => string | null;
  /** Reviewer's own install's entry point, or null when there is none. */
  readonly managed?: () => string | null;
  /** The Node the managed install runs on. */
  readonly node?: string;
}

export interface PhpServerChoice {
  readonly config: LspServerConfig;
  readonly availability: ProviderAvailability;
}

const configOf = (
  command: string,
  args: ReadonlyArray<string>,
  settings: unknown
): LspServerConfig => ({
  id: PHP_SERVER_ID,
  name: "PHP",
  patterns: PHP_PATTERNS,
  command,
  args,
  env: {},
  initializationOptions: null,
  settings,
});

/**
 * The PHP server to run, and what to say about it. Both halves come out of one
 * pass so the settings screen names the server that would actually be started.
 */
export const detectPhpServer = (
  options: PhpLookupOptions = {}
): PhpServerChoice => {
  const {
    resolve = findExecutable,
    managed = () => managedIntelephense(),
    node = process.execPath,
  } = options;

  const available = (
    config: LspServerConfig,
    detail: string
  ): PhpServerChoice => ({
    config,
    availability: { available: true, detail },
  });

  const intelephense = resolve("intelephense");
  if (intelephense !== null) {
    return available(
      configOf("intelephense", ["--stdio"], INTELEPHENSE_SETTINGS),
      `intelephense (${intelephense})`
    );
  }

  const installed = managed();
  if (installed !== null) {
    return available(
      configOf(node, [installed, "--stdio"], INTELEPHENSE_SETTINGS),
      `intelephense, installed by reviewer (${installed})`
    );
  }

  const phpactor = resolve("phpactor");
  if (phpactor !== null) {
    return available(
      configOf("phpactor", ["language-server"], null),
      `phpactor (${phpactor})`
    );
  }

  return {
    config: configOf("intelephense", ["--stdio"], INTELEPHENSE_SETTINGS),
    availability: {
      available: false,
      detail: `no PHP language server found — ${INSTALL_HINT}`,
      installer: intelephenseInstaller(),
    },
  };
};

const readText = (absolute: string): string | null => {
  try {
    return readFileSync(absolute, "utf8");
  } catch {
    return null;
  }
};

const DISK: LaravelFiles = { exists: existsSync, readText };

const isBlade = (path: string) => path.toLowerCase().endsWith(".blade.php");

/** Resolve after `ms` with `fallback`, unless `promise` settles first. */
const within = <A>(promise: Promise<A>, ms: number, fallback: A): Promise<A> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    timer.unref?.();
    void promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });

export interface PhpProviderOptions extends PhpLookupOptions {
  readonly files?: LaravelFiles;
  /** Starts the managed install; a test stands in its own. */
  readonly install?: () => Promise<void>;
}

/**
 * The built-in PHP provider for a repository: the generic LSP provider for the
 * server found, with Laravel's references answered ahead of it and PHPStan's
 * findings merged into its diagnostics.
 */
export const phpProviderFor = (
  root: string,
  options: PhpProviderOptions = {}
): LanguageProvider => {
  const { config, availability } = detectPhpServer(options);
  const files = options.files ?? DISK;
  const install = options.install ?? (() => installIntelephense());
  const lsp = makeLspProvider(config, { findCommand: options.resolve });
  const providerId = lsp.id;

  /**
   * The Laravel reference under the cursor, resolved — or null to let the
   * language server answer. Only a reference that lands somewhere counts.
   */
  const laravelDefinition = (request: {
    root: string;
    path: string;
    contents: string | null;
    position: { line: number; character: number };
  }): DefinitionResult | null => {
    const absolute = toAbsolute(request.root, request.path);
    const app = laravelAppRoot(request.root, absolute, files.exists);
    if (app === null) return null;
    const text = request.contents ?? files.readText(absolute);
    if (text === null) return null;
    const reference = laravelReferenceAt(text, request.position, {
      blade: isBlade(request.path),
    });
    if (reference === null) return null;
    const targets = laravelTargets(app, reference, files).flatMap((target) => {
      const path = toRepoRelative(request.root, target.absolute);
      if (path === null) return [];
      const range = {
        start: { line: target.line, character: 0 },
        end: { line: target.line, character: 0 },
      };
      return [
        {
          location: { path, range },
          name: reference.name,
          kind: reference.kind,
          containerName: "",
          preview: previewAt(
            files.readText(target.absolute) ?? "",
            target.line
          ),
        },
      ];
    });
    if (targets.length === 0) return null;
    return { providerId, origin: reference.range, targets };
  };

  const withPhpstan = (
    request: { root: string; path: string; contents: string | null },
    fromServer: ReadonlyArray<Diagnostic>
  ): Effect.Effect<ReadonlyArray<Diagnostic>> =>
    Effect.promise(async () => {
      // Blade is compiled before PHPStan could see it, and vendor code is
      // someone else's to analyse.
      if (isBlade(request.path) || request.path.split("/").includes("vendor"))
        return fromServer;
      const absolute = toAbsolute(request.root, request.path);
      const app = laravelAppRoot(request.root, absolute, files.exists);
      const binary = app === null ? null : phpstanFor(app, files.exists);
      const text = request.contents ?? files.readText(absolute);
      if (app === null || binary === null || text === null) return fromServer;
      const found = await within(
        phpstanDiagnostics(binary, app, absolute, text),
        PHPSTAN_PATIENCE_MS,
        []
      );
      return [...fromServer, ...found];
    });

  return {
    ...lsp,
    // The installer's state moves while an install runs, so it is read fresh
    // on every probe rather than captured with the rest.
    probe: () => Effect.sync(() => detectPhpServer(options).availability),

    diagnostics: (request) =>
      Effect.flatMap(lsp.diagnostics(request), (fromServer) =>
        withPhpstan(request, fromServer)
      ),

    definition: (request) =>
      Effect.suspend(() => {
        const laravel = laravelDefinition(request);
        return laravel === null
          ? lsp.definition(request)
          : Effect.succeed(laravel);
      }),

    install: () =>
      availability.available
        ? Effect.fail(
            new LanguageError({
              providerId,
              reason: "a PHP language server is already installed",
            })
          )
        : Effect.sync(() => {
            void install();
          }),
  };
};
