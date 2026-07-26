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
 *   cursor    `/model` piped into print mode, like claude.
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
      // Scoped to opencode's own hosted models — the provider this catalog
      // calls "OpenCode Zen". Dropping the argument would list every provider
      // the developer has credentials for, under a label that doesn't fit.
      return `opencode models opencode --verbose`
    case "cursor":
      return `printf '%s' '/model' | cursor-agent -p --output-format json`
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
  /^[A-Za-z0-9][A-Za-z0-9._/-]{1,63}(\[[\dA-Za-z]+\])?$/

/** The `provider/model` form opencode prints, and the form `--model` wants. */
const QUALIFIED_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][\w.-]*$/

/**
 * A display name for an id no CLI gave us one for: `sonnet` → `Sonnet`. Only
 * the first letter is touched — inventing more (expanding `4-5` to `4.5`,
 * say) would misname models as often as it helped.
 */
const labelFromId = (id: string): string =>
  id.length === 0 ? id : id.slice(0, 1).toUpperCase() + id.slice(1)

/**
 * Claude and cursor answer `/model` in print mode with a sentence:
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
 * `opencode models <provider> --verbose` → an id line, then that model as
 * pretty-printed JSON, repeated. The objects are framed by a `{` and a `}`
 * alone on their lines (the id line carries the qualified `provider/model`
 * form we actually pass to `--model`, which the object itself doesn't hold).
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
    models.push({ id, label: asString(parsed["name"]) ?? labelFromId(id) })
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
    case "cursor":
      return parseSlashModelOutput(stdout)
    case "codex":
      return parseCodexModels(stdout)
    case "opencode":
      return parseOpencodeModels(stdout)
  }
}

/**
 * The catalog with each provider's discovered models folded in. Discovery wins
 * on membership — it knows what this machine can actually run, and the curated
 * list goes stale — but a curated label wins over a derived one, so a model we
 * have a proper name for doesn't regress to a capitalised id.
 *
 * Two things survive discovery on purpose:
 *   - a provider that discovered nothing keeps its curated models untouched, so
 *     a missing CLI or a changed output format costs nothing;
 *   - the catalog's default model stays listed even when the CLI didn't name
 *     it. claude answers `/model` with aliases and never mentions the full id
 *     we default to, and a default that isn't in its own picker shows up as a
 *     bare id with no label.
 */
export const mergeDiscoveredModels = (
  discovered: ReadonlyMap<ChatProviderKind, ReadonlyArray<ChatModel>>,
  base: ChatModelCatalog = CHAT_MODEL_CATALOG
): ChatModelCatalog => ({
  ...base,
  providers: base.providers.map((provider) => {
    const found = discovered.get(provider.id) ?? []
    if (found.length === 0) return provider
    const curated = new Map(provider.models.map((m) => [m.id, m]))
    const models = found.map((model) => ({
      ...model,
      label: curated.get(model.id)?.label ?? model.label,
    }))
    const fallbackDefault =
      provider.id === base.defaults.provider &&
      !models.some((m) => m.id === base.defaults.model)
        ? [
            curated.get(base.defaults.model) ?? {
              id: base.defaults.model,
              label: labelFromId(base.defaults.model),
            },
          ]
        : []
    return { ...provider, models: [...fallbackDefault, ...models] }
  }),
})
