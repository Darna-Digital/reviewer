/**
 * Swift without anything to configure.
 *
 * Every Swift toolchain ships `sourcekit-lsp`, so a machine that can build
 * Swift can already serve it — the work here is only finding the copy that
 * actually runs, which on a Mac is less obvious than it looks.
 *
 * What gets picked, in order:
 *
 * 1. `sourcekit-lsp` on PATH, when it belongs to a real toolchain — one from
 *    swift.org on Linux, or one `swiftly` has put on PATH on a Mac. A developer
 *    who installed a toolchain expects it to be the one used.
 * 2. The server inside the developer directory `xcode-select` points at: Xcode's
 *    toolchain, or the Command Line Tools. macOS ships `/usr/bin/sourcekit-lsp`
 *    on every machine, but it is a shim that forwards to whichever developer
 *    directory is selected, so finding it on PATH says nothing about whether a
 *    server exists — and running it on a Mac with no developer tools does not
 *    start one, it opens a system dialog offering to install them. The shim is
 *    never run; the binary it would forward to is looked up and started directly.
 *
 * When neither is there the provider is still registered, reporting itself
 * unavailable with what to install, so `.swift` files are explained rather than
 * silently looking like a language reviewer has never heard of.
 */
import { execFileSync } from "node:child_process";
import * as Effect from "effect/Effect";
import type {
  LanguageProvider,
  ProviderAvailability,
} from "@reviewer/core/ports/language-provider";
import { loginEnvironment } from "../../shell/login-environment.ts";
import type { LspServerConfig } from "../lsp/lsp-config.ts";
import { findExecutable } from "../lsp/lsp-executable.ts";
import { makeLspProvider } from "../lsp/lsp-provider.ts";

/** Id of the built-in entry; the provider itself is `lsp:swift`. */
export const SWIFT_SERVER_ID = "swift";

/** `Package.swift` and the sources alike; there is nothing Swift without it. */
export const SWIFT_PATTERNS: ReadonlyArray<string> = [".swift"];

/** macOS's forwarding stub, present whether or not a toolchain is. */
const MACOS_SHIM = "/usr/bin/sourcekit-lsp";

/** Where `xcode-select --install` puts a developer directory. */
const COMMAND_LINE_TOOLS = "/Library/Developer/CommandLineTools";

/** How to install one, said once, wherever the settings screen shows it. */
const INSTALL_HINT =
  "install Xcode or the Command Line Tools (`xcode-select --install`), a toolchain from swift.org, or add a server to .reviewer/languages.json";

/**
 * How long `xcode-select -p` is trusted. Asking costs a process, and the provider
 * list is rebuilt every few seconds while the app is in use; a toolchain
 * installed under a running app is still found, just a minute late.
 */
const XCODE_SELECT_TTL_MS = 60_000;

export interface SwiftLookupOptions {
  /** Resolved path of a command on PATH, or null when it is not installed. */
  readonly resolve?: (command: string) => string | null;
  /** The developer's environment, for `DEVELOPER_DIR`. */
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: string;
  /** What `xcode-select -p` prints, or null when nothing is selected. */
  readonly selectedDeveloperDirectory?: () => string | null;
}

export interface SwiftServerChoice {
  readonly config: LspServerConfig;
  readonly availability: ProviderAvailability;
}

let selected: {
  readonly directory: string | null;
  readonly at: number;
} | null = null;

const xcodeSelectedDirectory = (now: number = Date.now()): string | null => {
  if (selected !== null && now - selected.at < XCODE_SELECT_TTL_MS)
    return selected.directory;
  let directory: string | null = null;
  try {
    const printed = execFileSync("xcode-select", ["-p"], {
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    directory = printed.length > 0 ? printed : null;
  } catch {
    directory = null;
  }
  selected = { directory, at: now };
  return directory;
};

/**
 * Where a developer directory keeps its server. Xcode's sits in its default
 * toolchain; the Command Line Tools, being a bare developer directory, keep it
 * at the top. `DEVELOPER_DIR` is accepted either as the directory or as the
 * `.app` above it, as `xcrun` accepts both.
 */
export const serverPathsIn = (
  developerDirectory: string
): ReadonlyArray<string> => {
  const base = developerDirectory.replace(/\/+$/, "");
  const root = base.endsWith(".app") ? `${base}/Contents/Developer` : base;
  return [
    `${root}/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp`,
    `${root}/usr/bin/sourcekit-lsp`,
  ];
};

const configOf = (command: string): LspServerConfig => ({
  id: SWIFT_SERVER_ID,
  name: "Swift",
  patterns: SWIFT_PATTERNS,
  command,
  args: [],
  env: {},
  initializationOptions: null,
});

/**
 * The Swift server to run, and what to say about it. Both halves come out of
 * one pass so the settings screen names the server that would actually be
 * started rather than re-deriving it.
 */
export const detectSwiftServer = (
  options: SwiftLookupOptions = {}
): SwiftServerChoice => {
  const {
    resolve = findExecutable,
    env = loginEnvironment(),
    platform = process.platform,
    selectedDeveloperDirectory = xcodeSelectedDirectory,
  } = options;
  const isMac = platform === "darwin";

  const available = (
    config: LspServerConfig,
    detail: string
  ): SwiftServerChoice => ({
    config,
    availability: { available: true, detail },
  });

  const onPath = resolve("sourcekit-lsp");
  if (onPath !== null && !(isMac && onPath === MACOS_SHIM)) {
    return available(configOf("sourcekit-lsp"), `sourcekit-lsp (${onPath})`);
  }

  const developerDirectory = isMac
    ? env["DEVELOPER_DIR"]?.trim() || selectedDeveloperDirectory()
    : null;
  const candidates =
    developerDirectory !== null ? serverPathsIn(developerDirectory) : [];
  for (const candidate of candidates) {
    if (resolve(candidate) !== null) {
      return available(
        configOf(candidate),
        `sourcekit-lsp, from the selected developer tools (${candidate})`
      );
    }
  }

  // Nothing installed. The entry still describes what it would run, so a file
  // operation stays quiet (the provider checks for its binary before it speaks)
  // while the providers list explains itself. On a Mac the command named is the
  // toolchain path just found missing, never the bare name: that would resolve
  // to the shim, pass the check, and open the install dialog.
  return {
    config: configOf(
      isMac
        ? (candidates[0] ?? `${COMMAND_LINE_TOOLS}/usr/bin/sourcekit-lsp`)
        : "sourcekit-lsp"
    ),
    availability: {
      available: false,
      detail: `no Swift language server found — ${INSTALL_HINT}`,
    },
  };
};

/**
 * The built-in Swift provider. Everything but the probe is the generic LSP
 * provider; the probe answers from the search above, so the reason a machine
 * has no Swift support is the reason it was actually given.
 */
export const swiftProviderFor = (
  options?: SwiftLookupOptions
): LanguageProvider => {
  const { config, availability } = detectSwiftServer(options);
  return {
    ...makeLspProvider(config),
    probe: () => Effect.succeed(availability),
  };
};

/** Test seam — forgets the cached `xcode-select` answer. */
export const resetSwiftDetection = (): void => {
  selected = null;
};
