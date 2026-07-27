/**
 * Asking each agent CLI which models it can run, instead of keeping a list by
 * hand. Every provider answers, but none of them answer the same way:
 *
 *   claude    `/model` piped into print mode. Answered locally — no API call,
 *             no turn, no cost — with a prose sentence listing its aliases.
 *   codex     `codex debug models` prints its whole catalog as JSON, including
 *             which entries its own UI lists.
 *   opencode  `opencode models <provider> --verbose` prints an id line then a
 *             pretty-printed JSON object per model.
 *   cursor    `cursor-agent --list-models` prints `id - Label` lines. Not
 *             `/model` like claude: cursor-agent has no local slash commands in
 *             print mode, so the same trick would spend a real (billed) turn
 *             asking the model about itself, and it also refuses to run at all
 *             in a directory the developer hasn't trusted.
 *
 * The commands are here with the parsers so the two can't drift apart, and the
 * parsers are pure so they can be tested against recorded CLI output.
 *
 * Discovery is an *enrichment*, never a gate: a CLI that isn't installed, is
 * slow, or has changed its output leaves the curated catalog standing (see
 * `mergeDiscoveredModels`). That is also why nothing here throws — an
 * unparseable answer is an empty list, not an error.
 */
import { CHAT_MODEL_CATALOG } from "./chats.catalog.ts"
import type {
  ChatModel,
  ChatModelCatalog,
  ChatProviderKind,
} from "../schema/chats.schema.ts"

/**
 * The shell command that asks `provider` what it can run. Written for the
 * user's login shell (that is how every other agent invocation reaches the
 * developer's real PATH), and reading nothing from stdin the caller doesn't
 * send — the prompt is piped in, so no CLI can sit waiting on input.
 */
export const modelDiscoveryCommand = (provider: ChatProviderKind): string => {
  switch (provider) {
    case "claude":
      return `printf '%s' '/model' | claude -p --output-format json`
    case "codex":
      return `codex debug models`
    case "opencode":
      // Unscoped on purpose: opencode brokers whichever upstream providers the
      // developer has credentials for, and all of them are runnable through
      // `opencode run --model <provider>/<model>`. They come back grouped by
      // vendor so the picker can show them that way.
      return `opencode models --verbose`
    case "cursor":
      return `cursor-agent --list-models`
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null

const parsedOrNull = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * The JSON object in a CLI's output, ignoring anything around it.
 *
 * Discovery runs through the developer's login+interactive shell (the only way
 * to see the PATH they actually have), which sources their rc files — and those
 * print things. A version-manager banner ahead of the payload is enough to make
 * `JSON.parse` throw on the whole stream, so the object is cut out from its
 * first brace to its last instead of trusting the stream to be clean.
 */
const jsonObjectIn = (text: string): unknown => {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  return parsedOrNull(text.slice(start, end + 1))
}

/**
 * A model id that could plausibly have come from a CLI rather than from its
 * prose. Deliberately strict: discovery runs against output shapes that can
 * change under us, and an id we invent resolves to nothing, so anything with
 * whitespace or punctuation beyond what real ids use is dropped.
 */
const PLAUSIBLE_MODEL_ID =
  /^[A-Za-z0-9][A-Za-z0-9._:/-]{1,127}(\[[\dA-Za-z]+\])?$/

/**
 * The `provider/model` form opencode prints, and the form `--model` wants.
 * More than two segments is normal (`github-models/ai21-labs/…`), and a
 * version suffix may carry a colon (`amazon.nova-lite-v1:0`) — both are real
 * ids that a tighter pattern would drop on the floor.
 */
const QUALIFIED_MODEL_ID =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._:-]*)+$/

/**
 * A display name for an id no CLI gave us one for: `sonnet` → `Sonnet`. Only
 * the first letter is touched — inventing more (expanding `4-5` to `4.5`,
 * say) would misname models as often as it helped.
 */
const labelFromId = (id: string): string =>
  id.length === 0 ? id : id.slice(0, 1).toUpperCase() + id.slice(1)

/**
 * A heading for an upstream vendor id: `amazon-bedrock` → `Amazon Bedrock`.
 * Derived rather than mapped, so a vendor the developer has credentials for
 * gets a readable heading without being known here — at the cost of the odd
 * imperfect capitalisation, which beats a table that has to be maintained.
 */
const vendorLabel = (id: string): string =>
  id.split(/[-_]/).filter(Boolean).map(labelFromId).join(" ")

/**
 * Claude answers `/model` in print mode with a sentence:
 *
 *   Current model: Sonnet 5 (default)
 *   Usage: /model <name>. Available: sonnet, opus, haiku, …, or a full model ID.
 *
 * so the aliases are read out of the `Available:` clause. `--output-format
 * json` wraps that sentence in a result envelope; a plain-text answer is read
 * directly, which is also what keeps this working if a CLI stops wrapping it.
 */
const parseSlashModelOutput = (stdout: string): ReadonlyArray<ChatModel> => {
  const parsed = jsonObjectIn(stdout)
  const result = isRecord(parsed) ? asString(parsed["result"]) : null
  // Reading the envelope's `result` matters beyond tidiness: in the raw stream
  // the sentence's line breaks are still escaped, so "the rest of the line"
  // would run on into the JSON that follows it.
  const text = result ?? stdout
  const available = /available:\s*([^\n]+)/i.exec(text)
  if (available?.[1] === undefined) return []
  return (
    available[1]
      .split(",")
      .map((part) => part.trim().replace(/\.$/, ""))
      // "or a full model ID" closes the sentence — it names no model.
      .filter((part) => part.length > 0 && !/^or\b/i.test(part))
      .filter((id) => PLAUSIBLE_MODEL_ID.test(id))
      .map((id) => ({ id, label: labelFromId(id) }))
  )
}

/**
 * `cursor-agent --list-models` → a heading, then one `id - Label` line per
 * model. Which one is active is marked in the label (`Composer 2.5 (current)`,
 * `Auto (default)`); byconvo tracks the selection itself, so those markers are
 * dropped rather than baked into a name the picker then shows forever.
 */
const CURSOR_ACTIVE_MARKER = /\s*\((?:default|current)\)\s*$/i

const parseListModelsOutput = (stdout: string): ReadonlyArray<ChatModel> =>
  stdout.split("\n").flatMap((line) => {
    const match = /^\s*(\S+)\s+-\s+(.+?)\s*$/.exec(line)
    if (match?.[1] === undefined || match[2] === undefined) return []
    const id = match[1]
    if (!PLAUSIBLE_MODEL_ID.test(id)) return []
    const label = match[2].replace(CURSOR_ACTIVE_MARKER, "")
    return [{ id, label: label.length > 0 ? label : labelFromId(id) }]
  })

/**
 * `codex debug models` → `{models:[{slug, display_name, visibility, …}]}`.
 * `visibility` is codex's own call on what belongs in a picker, so hidden and
 * deprecated entries are left out here too.
 */
const parseCodexModels = (stdout: string): ReadonlyArray<ChatModel> => {
  const parsed = jsonObjectIn(stdout)
  if (!isRecord(parsed) || !Array.isArray(parsed["models"])) return []
  return parsed["models"].flatMap((entry) => {
    if (!isRecord(entry)) return []
    if (entry["visibility"] !== "list") return []
    const id = asString(entry["slug"])
    if (id === null || !PLAUSIBLE_MODEL_ID.test(id)) return []
    return [{ id, label: asString(entry["display_name"]) ?? labelFromId(id) }]
  })
}

/**
 * `opencode models --verbose` → an id line, then that model as pretty-printed
 * JSON, repeated. The objects are framed by a `{` and a `}` alone on their
 * lines (the id line carries the qualified `provider/model` form we actually
 * pass to `--model`, which the object itself doesn't hold).
 *
 * Each model names the upstream vendor brokering it, which becomes its group:
 * one opencode rail can hold its own hosted models next to Bedrock's and
 * Copilot's, and only the grouping tells them apart.
 */
const parseOpencodeModels = (stdout: string): ReadonlyArray<ChatModel> => {
  const models: ChatModel[] = []
  let qualifiedId: string | null = null
  let objectLines: string[] | null = null
  for (const line of stdout.split("\n")) {
    const trimmed = line.trimEnd()
    if (objectLines === null) {
      if (trimmed === "{") {
        objectLines = [trimmed]
      } else if (QUALIFIED_MODEL_ID.test(trimmed.trim())) {
        // Requiring the `provider/model` form is what keeps a line of rc-file
        // noise ahead of the output from being read as a model id.
        qualifiedId = trimmed.trim()
      }
      continue
    }
    objectLines.push(trimmed)
    if (trimmed !== "}") continue
    const parsed = parsedOrNull(objectLines.join("\n"))
    objectLines = null
    if (!isRecord(parsed)) continue
    // Prefer the id line: `--model` wants `opencode/big-pickle`, while the
    // object's own `id` is the bare `big-pickle`.
    const bare = asString(parsed["id"])
    const provider = asString(parsed["providerID"])
    const id =
      qualifiedId ??
      (bare !== null && provider !== null ? `${provider}/${bare}` : null)
    qualifiedId = null
    if (id === null || !PLAUSIBLE_MODEL_ID.test(id)) continue
    // A model opencode has retired can still be listed; don't offer it.
    if (parsed["status"] === "deprecated") continue
    const group = provider ?? id.split("/")[0]
    models.push({
      id,
      label: asString(parsed["name"]) ?? labelFromId(id),
      ...(group !== undefined && group.length > 0
        ? { group: vendorLabel(group) }
        : {}),
    })
  }
  return models
}

/**
 * The models in a CLI's answer, or an empty list when it said nothing we
 * recognise — which the caller treats as "keep what was already there".
 */
export const parseDiscoveredModels = (
  provider: ChatProviderKind,
  stdout: string
): ReadonlyArray<ChatModel> => {
  switch (provider) {
    case "claude":
      return parseSlashModelOutput(stdout)
    case "cursor":
      return parseListModelsOutput(stdout)
    case "codex":
      return parseCodexModels(stdout)
    case "opencode":
      return parseOpencodeModels(stdout)
  }
}

/**
 * The catalog carrying each provider's discovered models. Every model a user
 * can pick comes through here: a provider whose CLI said nothing offers
 * nothing, which is the honest answer for an agent that isn't installed on this
 * machine, and leaves its chats running on that CLI's own default model.
 */
export const mergeDiscoveredModels = (
  discovered: ReadonlyMap<ChatProviderKind, ReadonlyArray<ChatModel>>,
  base: ChatModelCatalog = CHAT_MODEL_CATALOG
): ChatModelCatalog => ({
  ...base,
  providers: base.providers.map((provider) => ({
    ...provider,
    models: discovered.get(provider.id) ?? [],
  })),
})
