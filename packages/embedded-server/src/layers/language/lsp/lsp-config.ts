/**
 * `.byconvo/languages.json` — how a repository adds a language.
 *
 * This is the extensibility story: point byconvo at a language server binary
 * and the file extensions it owns, and every IDE feature in the app starts
 * working for that language. No plugin to write, no byconvo release to wait
 * for. Configured servers take priority over the built-in TypeScript provider,
 * so a project that prefers its own TypeScript server can say so.
 *
 * ```json
 * {
 *   "servers": [
 *     {
 *       "id": "rust-analyzer",
 *       "name": "Rust",
 *       "patterns": [".rs"],
 *       "command": "rust-analyzer"
 *     }
 *   ]
 * }
 * ```
 *
 * Parsing is deliberately forgiving: a malformed entry is dropped with a
 * reported reason instead of failing the whole file, so one typo cannot take
 * the other languages down with it.
 */

export interface LspServerConfig {
  readonly id: string
  readonly name: string
  /** Extensions (`.rs`) or whole basenames (`Dockerfile`), as in the port. */
  readonly patterns: ReadonlyArray<string>
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly env: Readonly<Record<string, string>>
  /** Passed verbatim as `initializationOptions` in the initialize request. */
  readonly initializationOptions: unknown
}

export interface LanguageConfig {
  readonly servers: ReadonlyArray<LspServerConfig>
  /** Human-readable reasons entries were dropped, for the settings screen. */
  readonly problems: ReadonlyArray<string>
}

export const CONFIG_PATH = ".byconvo/languages.json"

const EMPTY: LanguageConfig = { servers: [], problems: [] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback

const stringList = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
      )
    : []

const stringMap = (value: unknown): Readonly<Record<string, string>> => {
  if (!isRecord(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry
  }
  return out
}

/** Validate one entry, or explain why it cannot be used. */
const parseServer = (
  raw: unknown,
  index: number
): { server: LspServerConfig } | { problem: string } => {
  const at = `servers[${index}]`
  if (!isRecord(raw)) return { problem: `${at} is not an object` }

  const id = stringOr(raw["id"], "")
  if (id.length === 0) return { problem: `${at} is missing an "id"` }

  const command = stringOr(raw["command"], "")
  if (command.length === 0)
    return { problem: `${at} ("${id}") is missing a "command"` }

  const patterns = stringList(raw["patterns"])
  if (patterns.length === 0)
    return { problem: `${at} ("${id}") lists no "patterns"` }

  return {
    server: {
      id,
      name: stringOr(raw["name"], id),
      patterns,
      command,
      args: stringList(raw["args"]),
      env: stringMap(raw["env"]),
      initializationOptions: raw["initializationOptions"],
    },
  }
}

/** Parse the decoded contents of `.byconvo/languages.json`. */
export const parseLanguageConfig = (raw: unknown): LanguageConfig => {
  if (raw === null || raw === undefined) return EMPTY
  if (!isRecord(raw)) return { servers: [], problems: ["expected an object"] }

  const rawServers = raw["servers"]
  if (rawServers === undefined) return EMPTY
  if (!Array.isArray(rawServers))
    return { servers: [], problems: ['"servers" must be an array'] }

  const servers: Array<LspServerConfig> = []
  const problems: Array<string> = []
  const seen = new Set<string>()

  for (const [index, entry] of rawServers.entries()) {
    const parsed = parseServer(entry, index)
    if ("problem" in parsed) {
      problems.push(parsed.problem)
      continue
    }
    if (seen.has(parsed.server.id)) {
      problems.push(
        `duplicate server id "${parsed.server.id}" — ignoring the later one`
      )
      continue
    }
    seen.add(parsed.server.id)
    servers.push(parsed.server)
  }

  return { servers, problems }
}

/** Parse the file's text; invalid JSON is a problem, not a crash. */
export const parseLanguageConfigText = (text: string): LanguageConfig => {
  if (text.trim().length === 0) return EMPTY
  try {
    return parseLanguageConfig(JSON.parse(text))
  } catch (error) {
    return {
      servers: [],
      problems: [
        `${CONFIG_PATH} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}
