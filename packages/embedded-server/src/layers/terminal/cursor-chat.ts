/**
 * Minting a Cursor chat id before its terminal thread starts.
 *
 * The other agents fall into two camps: claude takes any id we hand it, and
 * opencode/codex leave theirs on disk for us to find (agent-session-capture.ts).
 * Cursor's TUI is in neither — it mints its own id and never says what it is
 * (there is no stream to read: the PTY carries an interactive UI, not events),
 * and the CLI's own chat store has no documented layout to read it back from.
 * Its *IDE* transcripts under `~/.cursor/projects/…/agent-transcripts` are a
 * separate store whose ids `--resume` does not accept, so scanning those would
 * produce ids that look right and silently fail to resume.
 *
 * What the CLI does offer is `cursor-agent create-chat`, which prints the id of
 * a fresh chat. So we create the chat ourselves and launch the TUI with
 * `--resume <id>` — the same "the id is ours before the agent starts" shape
 * claude threads get, just obtained by asking instead of by choosing.
 *
 * Two quirks shape this:
 *   - create-chat prints the id and then does not exit (a known upstream bug),
 *     so the id is taken off stdout and the process killed rather than waited
 *     on. A build that exits cleanly behaves identically — we just kill a
 *     process that has already gone. The kill has to reach the whole process
 *     group: the CLI is a grandchild of the shell we spawn, so killing the
 *     shell alone leaves it orphaned, still running and still holding stdout
 *     open — one stuck process per thread created, and a server that can't
 *     shut down cleanly.
 *   - everything here is best-effort and never throws or rejects. No id means
 *     the thread starts an unresumable conversation, which is exactly what
 *     cursor threads did before this existed.
 */
import { spawn, type ChildProcess } from "node:child_process"

/** Cursor prints a UUID today. Matched first, and anywhere in the output, so a
 * shell banner or a progress line ahead of it doesn't hide it. */
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i

/** The fallback shape for a build that prints some other opaque id: a line
 * that is nothing but one bare token. Requiring the whole line keeps prose
 * ("Created chat in …") and shell noise from being mistaken for an id, and
 * excluding `-` keeps half a uuid — which resumes nothing — from qualifying as
 * a token in its own right. An id that genuinely contains dashes and isn't a
 * uuid would go unrecognised; that trade buys a wrong id being impossible. */
const BARE_TOKEN_LINE = /^[A-Za-z0-9_]{6,64}$/

/**
 * The chat id in `create-chat` output, or null if it isn't there yet. Exported
 * for its own sake: this is the only part with judgement in it, and it has to
 * hold up against output shapes we can't pin down from the outside.
 *
 * `atEnd` says whether `output` is everything there will ever be. It matters
 * only for the bare-token fallback: mid-stream, the final line may be half a
 * token that a chunk boundary cut in two, and half an id resumes nothing — so
 * an unterminated last line is only trusted once the process is done writing.
 * A truncated uuid can't be mistaken for a whole one, so the uuid path needs
 * no such care.
 */
export const cursorChatIdFrom = (
  output: string,
  { atEnd = false }: { atEnd?: boolean } = {}
): string | null => {
  const uuid = UUID_PATTERN.exec(output)
  if (uuid !== null) return uuid[0]
  const lines = output.split("\n")
  const complete = atEnd ? lines : lines.slice(0, -1)
  for (const line of complete) {
    const trimmed = line.trim()
    if (BARE_TOKEN_LINE.test(trimmed)) return trimmed
  }
  return null
}

/**
 * How long to wait for the id. Generous enough for a cold CLI start, short
 * enough that a cursor-agent stuck on something we can't see (an untrusted
 * workspace prompts, and `--trust` only applies to headless runs) costs the
 * user a delayed terminal rather than a hung one.
 */
const MINT_TIMEOUT_MS = 10000

/** The user's shell — the CLI is launched through it for the same reason every
 * other agent invocation is: a bare spawn under a GUI launch misses the
 * developer's real PATH (see agent-pty.ts). */
const userShell = (): string => process.env["SHELL"] ?? "bash"

const ignoringAnAlreadyDeadProcess = (act: () => void): boolean => {
  try {
    act()
    return true
  } catch {
    return false
  }
}

/**
 * Create a Cursor chat in `cwd` and return its id, or null if one couldn't be
 * had — the CLI isn't installed, it never printed an id, or it took too long.
 */
export const mintCursorChatId = (cwd: string): Promise<string | null> =>
  new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(userShell(), ["-l", "-c", "cursor-agent create-chat"], {
        cwd,
        // Ignore stdin so the CLI can never sit waiting on input we won't send.
        stdio: ["ignore", "pipe", "ignore"],
        // Its own process group, so the kill below can take the CLI down with
        // the shell that launched it.
        detached: true,
      })
    } catch {
      resolve(null)
      return
    }
    // The child is deliberately *not* unref'd: it is what keeps the event loop
    // alive long enough for its own `close` to be delivered. Unreferenced, a
    // shell that exits immediately (no cursor-agent on PATH) can lose the race
    // and leave this promise hanging forever. It can't outstay its welcome —
    // the timeout below always settles and kills it.

    let output = ""
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const finish = (id: string | null): void => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      // Release the pipe first: an orphan holding the read end open keeps this
      // process alive even once the writer is gone.
      child.stdout?.destroy()
      const pid = child.pid
      // A negative pid signals the whole group. Falling back to the child alone
      // covers a group that has already exited (and any platform without one).
      const killedTheGroup =
        pid !== undefined &&
        ignoringAnAlreadyDeadProcess(() => process.kill(-pid, "SIGKILL"))
      if (!killedTheGroup) {
        ignoringAnAlreadyDeadProcess(() => child.kill("SIGKILL"))
      }
      resolve(id)
    }

    timer = setTimeout(
      () => finish(cursorChatIdFrom(output, { atEnd: true })),
      MINT_TIMEOUT_MS
    )
    timer.unref?.()

    child.stdout?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => {
      output += chunk
      const id = cursorChatIdFrom(output)
      if (id !== null) finish(id)
    })
    child.on("error", () => finish(null))
    child.on("close", () => finish(cursorChatIdFrom(output, { atEnd: true })))
  })
