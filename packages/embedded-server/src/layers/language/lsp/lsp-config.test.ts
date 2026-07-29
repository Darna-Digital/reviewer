import { describe, expect, it } from "vitest"
import { parseLanguageConfig, parseLanguageConfigText } from "./lsp-config.ts"

const rust = {
  id: "rust-analyzer",
  name: "Rust",
  patterns: [".rs"],
  command: "rust-analyzer",
}

describe("parseLanguageConfig", () => {
  it("accepts a minimal server and defaults the rest", () => {
    const { servers, problems } = parseLanguageConfig({
      servers: [{ id: "gopls", patterns: [".go"], command: "gopls" }],
    })
    expect(problems).toEqual([])
    expect(servers).toEqual([
      {
        id: "gopls",
        // The name falls back to the id.
        name: "gopls",
        patterns: [".go"],
        command: "gopls",
        args: [],
        env: {},
        initializationOptions: undefined,
      },
    ])
  })

  it("keeps args, env and initializationOptions", () => {
    const { servers } = parseLanguageConfig({
      servers: [
        {
          ...rust,
          args: ["--stdio", 7],
          env: { RA_LOG: "info", NUMERIC: 3 },
          initializationOptions: { cargo: { allFeatures: true } },
        },
      ],
    })
    expect(servers[0].args).toEqual(["--stdio"])
    expect(servers[0].env).toEqual({ RA_LOG: "info" })
    expect(servers[0].initializationOptions).toEqual({
      cargo: { allFeatures: true },
    })
  })

  it("treats a missing servers key as no configuration", () => {
    expect(parseLanguageConfig({})).toEqual({ servers: [], problems: [] })
    expect(parseLanguageConfig(null)).toEqual({ servers: [], problems: [] })
  })

  it("reports a non-object document", () => {
    expect(parseLanguageConfig([1, 2]).problems).toEqual(["expected an object"])
  })

  it("reports a non-array servers key", () => {
    expect(parseLanguageConfig({ servers: {} }).problems).toEqual([
      '"servers" must be an array',
    ])
  })

  it("drops an entry with no id, command or patterns and says why", () => {
    const { servers, problems } = parseLanguageConfig({
      servers: [
        { patterns: [".x"], command: "x" },
        { id: "y", patterns: [".y"] },
        { id: "z", command: "z" },
        "nonsense",
      ],
    })
    expect(servers).toEqual([])
    expect(problems).toEqual([
      'servers[0] is missing an "id"',
      'servers[1] ("y") is missing a "command"',
      'servers[2] ("z") lists no "patterns"',
      "servers[3] is not an object",
    ])
  })

  it("keeps the valid entries alongside a broken one", () => {
    const { servers, problems } = parseLanguageConfig({
      servers: [{ id: "broken" }, rust],
    })
    expect(servers.map((s) => s.id)).toEqual(["rust-analyzer"])
    expect(problems).toHaveLength(1)
  })

  it("ignores a duplicate id", () => {
    const { servers, problems } = parseLanguageConfig({
      servers: [rust, { ...rust, command: "other" }],
    })
    expect(servers).toHaveLength(1)
    expect(servers[0].command).toBe("rust-analyzer")
    expect(problems[0]).toContain("duplicate server id")
  })

  it("drops blank patterns and rejects an entry left with none", () => {
    expect(
      parseLanguageConfig({ servers: [{ ...rust, patterns: ["", "   "] }] })
        .problems[0]
    ).toContain('no "patterns"')
  })
})

describe("parseLanguageConfigText", () => {
  it("parses JSON text", () => {
    expect(
      parseLanguageConfigText(JSON.stringify({ servers: [rust] })).servers
    ).toHaveLength(1)
  })

  it("treats an empty file as no configuration", () => {
    expect(parseLanguageConfigText("   \n")).toEqual({
      servers: [],
      problems: [],
    })
  })

  it("reports invalid JSON instead of throwing", () => {
    const { servers, problems } = parseLanguageConfigText("{ servers: ] }")
    expect(servers).toEqual([])
    expect(problems[0]).toContain("not valid JSON")
  })
})
