import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import {
  detectSwiftServer,
  serverPathsIn,
  SWIFT_PATTERNS,
  swiftProviderFor,
} from "./swift-server.ts";

const XCODE = "/Applications/Xcode.app/Contents/Developer";
const XCODE_SERVER = `${XCODE}/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp`;
const CLT = "/Library/Developer/CommandLineTools";
const CLT_SERVER = `${CLT}/usr/bin/sourcekit-lsp`;
const SHIM = "/usr/bin/sourcekit-lsp";

/**
 * A machine: which executables exist (by PATH name or absolute path), what the
 * developer's environment holds, and what `xcode-select -p` would say.
 */
const machine = (
  installed: Readonly<Record<string, string>>,
  options: {
    readonly platform?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly selected?: string | null;
  } = {}
) => ({
  resolve: (command: string) => installed[command] ?? null,
  platform: options.platform ?? "darwin",
  env: options.env ?? {},
  selectedDeveloperDirectory: () => options.selected ?? null,
});

describe("detectSwiftServer", () => {
  it("takes a toolchain's sourcekit-lsp from PATH", () => {
    const { config, availability } = detectSwiftServer(
      machine(
        { "sourcekit-lsp": "/home/dev/.swiftly/bin/sourcekit-lsp" },
        { platform: "linux" }
      )
    );
    expect(config.command).toBe("sourcekit-lsp");
    expect(config.args).toEqual([]);
    expect(availability).toEqual({
      available: true,
      detail: "sourcekit-lsp (/home/dev/.swiftly/bin/sourcekit-lsp)",
    });
  });

  it("prefers a toolchain on PATH over the selected Xcode on a Mac", () => {
    const { config } = detectSwiftServer(
      machine(
        {
          "sourcekit-lsp": "/Users/dev/.swiftly/bin/sourcekit-lsp",
          [XCODE_SERVER]: XCODE_SERVER,
        },
        { selected: XCODE }
      )
    );
    expect(config.command).toBe("sourcekit-lsp");
  });

  it("looks through the macOS shim to the selected Xcode's toolchain", () => {
    const { config, availability } = detectSwiftServer(
      machine(
        { "sourcekit-lsp": SHIM, [XCODE_SERVER]: XCODE_SERVER },
        { selected: XCODE }
      )
    );
    expect(config.command).toBe(XCODE_SERVER);
    expect(availability.available).toBe(true);
    expect(availability.detail).toContain(XCODE_SERVER);
  });

  it("finds the Command Line Tools' server when they are what is selected", () => {
    const { config } = detectSwiftServer(
      machine(
        { "sourcekit-lsp": SHIM, [CLT_SERVER]: CLT_SERVER },
        { selected: CLT }
      )
    );
    expect(config.command).toBe(CLT_SERVER);
  });

  it("lets DEVELOPER_DIR override what xcode-select says", () => {
    const beta = "/Applications/Xcode-beta.app";
    const betaServer = `${beta}/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/sourcekit-lsp`;
    const { config } = detectSwiftServer(
      machine(
        {
          "sourcekit-lsp": SHIM,
          [XCODE_SERVER]: XCODE_SERVER,
          [betaServer]: betaServer,
        },
        { selected: XCODE, env: { DEVELOPER_DIR: beta } }
      )
    );
    expect(config.command).toBe(betaServer);
  });

  it("never runs the shim on a Mac with no developer tools", () => {
    const { config, availability } = detectSwiftServer(
      machine({ "sourcekit-lsp": SHIM }, { selected: null })
    );
    expect(config.command).not.toBe(SHIM);
    expect(config.command).not.toBe("sourcekit-lsp");
    expect(availability.available).toBe(false);
    expect(availability.detail).toContain("xcode-select --install");
  });

  it("reports itself unavailable, with what to install, on a bare Linux box", () => {
    const { config, availability } = detectSwiftServer(
      machine({}, { platform: "linux" })
    );
    expect(config.command).toBe("sourcekit-lsp");
    expect(availability.available).toBe(false);
    expect(availability.detail).toContain("swift.org");
  });

  it("does not treat /usr/bin/sourcekit-lsp as a shim off macOS", () => {
    const { config, availability } = detectSwiftServer(
      machine({ "sourcekit-lsp": SHIM }, { platform: "linux" })
    );
    expect(config.command).toBe("sourcekit-lsp");
    expect(availability.available).toBe(true);
  });
});

describe("serverPathsIn", () => {
  it("accepts the .app as well as its developer directory", () => {
    expect(serverPathsIn("/Applications/Xcode.app")).toEqual(
      serverPathsIn(XCODE)
    );
    expect(serverPathsIn(`${XCODE}/`)).toEqual(serverPathsIn(XCODE));
  });
});

describe("the Swift provider", () => {
  it("claims Swift sources and package manifests", () => {
    expect(SWIFT_PATTERNS).toContain(".swift");
  });

  it("is the generic LSP provider, and answers the probe from the search", async () => {
    const provider = swiftProviderFor(
      machine(
        { "sourcekit-lsp": SHIM, [XCODE_SERVER]: XCODE_SERVER },
        { selected: XCODE }
      )
    );
    expect(provider.id).toBe("lsp:swift");
    expect(provider.transport).toBe("lsp-stdio");
    expect(provider.capabilities.definition).toBe(true);
    expect(provider.capabilities.references).toBe(true);
    expect(await Effect.runPromise(provider.probe("/repo"))).toEqual({
      available: true,
      detail: `sourcekit-lsp, from the selected developer tools (${XCODE_SERVER})`,
    });
  });

  it("stays quiet on a machine with no Swift server rather than failing", async () => {
    // A selected directory with nothing in it, so the real binary check the
    // provider makes before speaking fails here too, whatever this machine has.
    const provider = swiftProviderFor(
      machine({ "sourcekit-lsp": SHIM }, { selected: "/nonexistent/Developer" })
    );
    const request = {
      root: "/repo",
      path: "Sources/App/main.swift",
      contents: "",
    };
    expect(
      await Effect.runPromise(
        provider.definition({ ...request, position: { line: 0, character: 0 } })
      )
    ).toEqual({ providerId: null, origin: null, targets: [] });
    expect(await Effect.runPromise(provider.diagnostics(request))).toEqual([]);
  });
});
