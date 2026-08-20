# Background agent sessions on a cloud box — provider analysis

**Question.** Can byconvo run agent sessions on a cloud machine where my Claude Code,
Codex, opencode and Cursor subscriptions live, let me pick that machine when I open a
session, and get a pull request back that I review in byconvo?

**Answer.** Yes, and byconvo is closer to it than it looks. The four providers are
already driven headlessly by `packages/embedded-server/src/layers/chats/providers.ts`.
Everything that makes those invocations *local* is a handful of Node calls, not a
design assumption. The work is moving one seam — where the process runs — not
re-integrating four agents.

The parts that are genuinely hard are not technical: they are credential residency and
per-seat licensing. Those are covered under [Sharp edges](#sharp-edges).

---

## 1. What byconvo already does

Today a chat turn is a local CLI invocation:

| Step | Where it lives |
| --- | --- |
| Build the provider command | `chats/providers.ts` — `chatTurnProgram()` |
| Launch it through the user's login shell | `providers.ts` — `inLoginShell()`, `$SHELL -l -c` |
| Spawn, feed prompt on stdin, read NDJSON stdout | `chats/chat-runtime.ts` — `node:child_process.spawn` |
| Parse the stream into canonical events | `claude-stream.ts`, `codex-stream.ts`, `cursor-stream.ts`, `opencode-stream.ts` |
| Persist and fan out to sockets | `chats/store.ts`, `/api/chats/stream` |
| Recover the CLI's own session id | `terminal/agent-session-capture.ts` (`minted` vs `discovered`) |
| Discover models | `core/chats/functions/model-discovery.ts` |
| Read/write git, open and review PRs | `layers/git`, `layers/github`, `ports/git-exec.ts` |

The provider layer is the expensive, tested part, and none of it is local by nature.
The local assumptions are narrow and enumerable:

1. `spawn()` runs on this machine.
2. `chat.origin.repoPath` is a path on this filesystem.
3. Dropped images are written to a local temp file whose path is put in the prompt.
4. `agent-session-capture.ts` scans CLI session files under the *local* home directory.
5. `$SHELL` is the developer's shell; `inLoginShell` depends on their rc files for PATH.
6. Model discovery shells out on this machine.

Move those six and a chat runs anywhere.

---

## 2. Provider deep dive

### 2.1 Claude Code

**Headless contract.** `claude -p --output-format stream-json --verbose
--include-partial-messages` is the documented programmatic path, and it is exactly
what byconvo already emits. `--json-schema` gives structured output, `--resume <id>` /
`--session-id <id>` handle continuity, and from v2.1.223 a session is resolvable by id
from any directory on the machine, not only from the project it started in. Subagent
messages carry `parent_tool_use_id`, so a remote runner can rebuild the full tree.
`--bare` skips hook/plugin/MCP/CLAUDE.md discovery — the right default for a shared
box, except that it also refuses to read OAuth credentials, so it forces an API key.

**Authorizing a box.** `claude setup-token` mints a one-year OAuth token, printed once,
consumed as `CLAUDE_CODE_OAUTH_TOKEN`. Anthropic documents it for exactly this case:
"CI pipelines, scripts, or other environments where interactive browser login isn't
available." It requires Pro, Max, Team or Enterprise, and it is *model requests only* —
it cannot establish Remote Control sessions or fetch claude.ai connectors.

Watch the precedence order. `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` both rank
**above** `CLAUDE_CODE_OAUTH_TOKEN`, so a box that has a stray API key in its
environment will quietly bill the API instead of the subscription. Credentials live in
`~/.claude/.credentials.json` (mode 0600) on Linux, relocatable with
`CLAUDE_CONFIG_DIR` — which is the hook for per-user isolation on one box.

**Anthropic already ships this product.** Claude Code on the web runs each session in
an isolated Anthropic-managed VM: clones the repo, works on a branch, creates the PR,
and can then watch that PR and auto-fix CI failures and review comments. `claude --cloud
"<task>"` starts one from the terminal; `claude --teleport` pulls it back down. The CLI
can queue follow-ups into a running cloud session with `claude -p "msg" --cloud
<session-id>`.

More interesting for byconvo: **self-hosted environments** (Team/Enterprise, public
beta). You run *runners* on your own hosts; Anthropic's control plane queues sessions to
them; the runner clones the repo and spawns a child Claude Code process on your machine.
All traffic is outbound to `api.anthropic.com`; nothing connects inward. Sessions
authenticate with an Anthropic-issued, session-scoped OAuth token delivered by the
control plane — the box never holds a long-lived credential. And crucially, **a runner
locks to one user account** on its first session and serves only that account until it
drains. That is the same isolation rule any byconvo box will need, arrived at
independently.

`claude --remote-control` is the third variant: expose an always-on machine's local
session for monitoring from the web and mobile. Available on Pro and Max. It is the
closest existing analogue to what you described, minus byconvo's review surface.

**Limits.** Cloud sessions share the account's rate limits; running tasks in parallel
consumes them proportionately. There is no separate compute charge, and no separate
quota.

---

### 2.2 Codex

**Headless contract.** `codex exec --json`, prompt via `-` on stdin, `codex exec resume
<session-id>` — again what byconvo already emits. There is also an official
`@openai/codex-sdk` (TypeScript) that spawns the same CLI and exchanges JSONL over
stdio, with `runStreamed()` yielding `item.completed` / `turn.completed` events.

**Codex is the most remote-ready of the four**, by a distance. Beyond `exec`, the CLI
carries:

- `codex app-server` — JSON-RPC 2.0, MCP-shaped, over **stdio**, **unix socket**, or
  **`ws://IP:PORT`**. Threads, turns, items, approvals, skills, MCP management. This is
  the interface the official VS Code extension runs on.
- `codex app-server daemon` + `codex agents` — a shared local app-server daemon hosting
  many agent sessions, with a command to browse all of them. A session directory for one
  machine, already built.
- `codex app-server bootstrap` — "durable local app-server management for SSH-driven
  use". Explicitly designed for the box-you-ssh-into case.
- `codex remote-control` — pairing codes and an `environmentId`, so a controller device
  can drive an app-server on another machine.
- `codex exec-server --remote <url> --environment-id <id>` — registers a local
  exec-server with an environment registry and reconnects over a Noise relay, so tool
  execution can happen on a different machine from the agent loop.
- `codex cloud` / `codex apply` — browse Codex Cloud tasks and apply their diffs
  locally. Codex Cloud opens PRs of its own.

The app-server's auth surface matters for byconvo's UX: `account/login/start` accepts
`chatgptDeviceCode`, which means **byconvo could render "connect this box to ChatGPT"
in its own UI** — show the code, poll `account/login/completed` — with no SSH session
and no browser on the box. `account/rateLimits/read` and `account/usage/read` would let
the session picker show what quota a box has left.

Two constraints on the WebSocket transport: it is marked **experimental and
unsupported**, and any request carrying an `Origin` header is rejected with 403. A
browser cannot talk to it directly; byconvo's server has to proxy.

**Authorizing a box.** `$CODEX_HOME/auth.json` holds `tokens` and `last_refresh`. Access
tokens refresh within a 5-minute window; a full refresh happens on an 8-day interval.
The refresh tokens **rotate, and reuse is detected** — the CLI ships distinct error
strings for `refresh_token_expired`, `refresh_token_reused` ("your refresh token was
already used"), and `refresh_token_invalidated`. There is no file locking around
`auth.json` in the source.

The practical consequence is important: *do not rsync `auth.json` from your laptop to
the box.* Two machines rotating the same refresh token will invalidate each other at
unpredictable times. Log the box in on its own — device code, `codex login
--with-access-token`, `CODEX_ACCESS_TOKEN`, or an API key.

---

### 2.3 opencode

**opencode is already the architecture you are asking for.** It is a client/server
product: the TUI is just a client. `opencode serve --port <n> --hostname <h> --cors
<origin>` runs a headless HTTP server publishing an OpenAPI 3.1 spec at `/doc`, an SSE
stream at `/global/event`, and REST endpoints for projects, sessions, config, providers
and VCS. There is a generated, type-safe `@opencode-ai/sdk`. `OPENCODE_SERVER_PASSWORD`
(username `opencode`, overridable) puts HTTP basic auth in front of it.

For byconvo this means opencode needs **no CLI spawning and no stdout parsing at all** —
byconvo becomes an API client. It is the natural first provider to port to a remote box,
because the remote case and the local case are the same code.

`opencode acp` additionally speaks the Agent Client Protocol over stdio, which Cursor
also supports; that is a plausible long-term convergence point for byconvo's transport
layer.

**Authorizing a box.** Credentials sit in `~/.local/share/opencode/auth.json`. OAuth is
exposed *over the server API* (`POST /provider/{id}/oauth/authorize` and
`/oauth/callback`), so the same "connect from byconvo's UI" flow is available here too.
opencode supports ChatGPT Plus/Pro, GitHub Copilot and GitLab Duo subscriptions
directly.

**The one thing you cannot do.** From opencode's own provider documentation:

> There are plugins that allow you to use your Claude Pro/Max models with OpenCode.
> Anthropic explicitly prohibits this. Previous versions of OpenCode came bundled with
> these plugins but that is no longer the case as of 1.3.0.

So "put all my subscriptions on one box" resolves to: put each vendor's *own* client on
the box, authorized with that vendor's subscription. Rerouting a Claude subscription
into a third-party client is off the table, and opencode removed the ability.

**Security note.** Basic auth plus a CORS list is the whole protection model, and the
server has full tool access to the box. It should never be exposed to the public
internet — bind to loopback and reach it through a tunnel or mTLS.

---

### 2.4 Cursor

**Headless contract.** `cursor-agent -p --output-format stream-json
--stream-partial-output`, with `--resume <chat-id>`, `--force` for unattended writes,
`--list-models`, and a `--sandbox <enabled|disabled>` mode that also controls network
access. byconvo already uses all of these. Cursor also supports ACP.

**Cursor is the easiest of the four to authorize headlessly.** The docs are explicit
that interactive login must not be used in CI; instead you mint a user API key in the
dashboard and set `CURSOR_API_KEY`. A plain environment variable, no OAuth dance, no
rotation hazard. That makes Cursor the least painful provider to stand up on a box —
and, correspondingly, the one where an accidentally leaked box gives away the most with
the least friction.

Two operational details worth carrying into a fresh box image: `cursor-agent` refuses to
run in a directory the user has not trusted (byconvo's `model-discovery.ts` already
documents this), and its permission model has only one real switch — `--force` — with no
sandbox tier between "ask" and "don't ask", which is why byconvo maps `acceptEdits` and
`fullAccess` to the same flag.

**Cursor Cloud Agents.** `POST https://api.cursor.com/v1/agents` takes
`source.repository` + `source.ref`, a prompt, session-scoped environment variables, and
a webhook URL; the response and webhook payload carry the agent's branch and **pull
request URL**. Environments are configured in `.cursor/environment.json` via agent-led
setup, a snapshot, or a Dockerfile. The v1 API is public beta (webhooks currently land
on v0). Of the four, this is the one whose hosted API is a drop-in for "kick off work,
get a PR back" without operating any box at all.

---

## 3. Multiplayer, precisely

Three different things get called multiplayer, and only one of them is prohibited.

1. **Many sessions, one person.** Fine on every plan, no API key, no team tier. This is
   byconvo's main case. The only thing pushing back is rate limits, which are per
   account — six parallel sessions divide your quota rather than multiplying it.
2. **Many people, each with their own seat, one box.** **Allowed**, and this is the real
   answer to "can my team use this". Nobody shares a seat; you are colocating N seats on
   shared hardware. What it needs is a per-user credential scope on the box and a
   per-user connect flow in byconvo. All four providers support a subscription-backed
   headless credential for exactly this.
3. **Many people, one seat.** Prohibited on Claude and ChatGPT alike, and enforced.

### How each provider does case 2, on individual plans

| Provider | Per-user credential | How the box gets it | State left on the box |
| --- | --- | --- | --- |
| Cursor | user API key → `CURSOR_API_KEY` | minted in the dashboard, pasted into byconvo once | none — injected per session |
| Claude Code | `CLAUDE_CODE_OAUTH_TOKEN` | each person runs `claude setup-token` on their own laptop | none, if injected per session |
| Codex | ChatGPT OAuth / personal access token | `codex login --device-auth`, under that user's `CODEX_HOME` | `$CODEX_HOME/auth.json`, per user |
| opencode | whichever provider they connect | `POST /provider/{id}/oauth/authorize` on their own server instance | per-user data dir, or one server each |

Note the distinction the pricing pages blur: a *subscription-backed* credential (Cursor's
user key, Claude's `setup-token`, Codex's device login) authenticates as that person and
consumes that person's plan. That is not a metered platform API key billed per token.
All four support the former headlessly.

### What Codex adds that the others don't

Codex has the richest credential model of the four, and the one that most directly
anticipates a background-agent runner:

- **Device login is the sanctioned remote path.** The CLI says so itself when the browser
  flow starts: "On a remote or headless machine? Use `codex login --device-auth`
  instead." Each teammate authorizes the box from their own browser and no credential is
  ever copied — which sidesteps the refresh-token rotation trap entirely.
- **`CODEX_HOME`** is a clean per-user credential scope, so one box can carry several
  people's logins side by side without separate OS users.
- **Personal access tokens.** `AuthMode::PersonalAccessToken`, loaded via `codex login
  --with-access-token` or `CODEX_ACCESS_TOKEN` — a ChatGPT-backed, long-lived, per-person
  credential you can hand a process, which is neither a shared password nor a metered API
  key.
- **Agent Identity.** `register_agent_identity` mints an Ed25519 keypair and an
  `agent_runtime_id`; JWTs are issued by `chatgpt.com/codex-backend/agent-identity` with
  audience `codex-app-server`; the stored record carries the ChatGPT account id and plan
  type; `register_agent_task` registers work under it; and `codex exec-server --remote
  --environment-id --use-agent-identity-auth` uses it to register a runner remotely.
  Structurally that is a *machine identity for a background agent acting on behalf of a
  ChatGPT account* — precisely the primitive a product like this wants.

**Temper that.** Agent Identity has no documented end-user path to mint one; it arrives
through `CODEX_ACCESS_TOKEN` and reads like Codex Cloud's own harness plumbing.
`exec-server`, `remote-control` and the `ws://` transport are all flagged experimental or
unsupported. And device login can be turned off server-side — the CLI ships the error
"device code login is not enabled for this Codex server," which business workspaces have
reported hitting until an admin enables it. Design against `--device-auth` plus
`CODEX_HOME`; treat the rest as a direction of travel, not a foundation.

### What this means for byconvo

The box is multi-tenant; the credential is single-tenant. Credentials attach to the
byconvo **user**, never to the runner. That implies a per-user "connect your agents" flow
— device code for Codex, paste-a-token for Claude and Cursor, OAuth for opencode — and
session dispatch that resolves user → credential scope → per-user `CODEX_HOME` /
`CLAUDE_CONFIG_DIR` / OS user / container.

It also promotes sharp edge 1 (section 6) into the load-bearing constraint: on a shared box a
`fullAccess` session can read every other person's credentials in the adjacent home
directory. Multiplayer makes per-session isolation a security requirement rather than
good hygiene.

---

## 4. Whose credential is it?

Both models work — a lead adding one credential for the team, and each person adding
their own — but they are not alternatives. They apply to different *kinds* of credential,
and the deciding question is always: who does this credential identify?

### Seat credentials — identify a person

Claude's `setup-token`, Codex's ChatGPT device login and personal access tokens, a Cursor
*user* API key, opencode's ChatGPT and Copilot OAuth. These carry a person's identity and
consume that person's plan. **A lead cannot add one on the team's behalf** — that is
several people on one seat, the prohibited case. Per-user only, always.

### Org-provisioned seats — central billing, personal identity

Claude for Teams and Enterprise, Claude Console, ChatGPT Business, Cursor Teams. Here the
lead genuinely does set it up for everyone — but what they provision is *access*, not a
token. Members still authenticate as themselves. Anthropic's own instructions make the
shape explicit: for Teams, "team members install Claude Code and log in with their
Claude.ai accounts"; on Console, an admin invites users and each one creates their own
Claude Code key.

### Workload credentials — identify a machine or an org

An Anthropic Console API key, an OpenAI platform key, Bedrock / Vertex / Foundry, an LLM
gateway, an opencode Zen key, and **Cursor service-account keys, which bill to the team
that owns the service account** rather than to a user's plan. These are the only
credentials that can legitimately sit on a box and serve everybody. That is what API keys
are for — and the price is that they are metered per token instead of flat-rate.

**Better than a shared static key.** Do not park a long-lived key on a box running
agent-authored shell commands. Claude Code's `apiKeyHelper` runs a script that returns a
key, re-called after five minutes or on a 401 (tunable with
`CLAUDE_CODE_API_KEY_HELPER_TTL_MS`), so byconvo mints a per-session credential and the
box stores nothing. Workload Identity Federation goes further — the box proves its
identity over OIDC and exchanges it for short-lived credentials, holding no secret at
all. Codex has the matching primitive in `cli_auth_credentials_store = "ephemeral"`,
which keeps credentials in memory for the current process only; combined with `codex
login --with-access-token` reading from stdin, a session runs with zero credential
residue on disk.

### Which methods byconvo may pool

| Provider | Auth method | Identifies | Poolable |
| --- | --- | --- | --- |
| Claude Code | setup-token OAuth | a person | no |
| Claude Code | Console API key | an org | yes |
| Claude Code | apiKeyHelper · federation | a workload | yes — preferred |
| Claude Code | Bedrock · Vertex · Foundry | a cloud account | yes |
| Codex | ChatGPT device login | a person | no |
| Codex | personal access token | a person | no |
| Codex | OpenAI platform key | an org | yes |
| Cursor | user API key | a person | no |
| Cursor | service account key | a team | yes |
| opencode | ChatGPT · Copilot OAuth | a person | no |
| opencode | Zen or provider API key | an org | yes |

### The model this implies

Support both scopes, and make the distinction structural rather than a note in the docs.
A `poolable` flag on each auth method is what stops the product quietly inviting a
licence violation.

```
Credential {
  id, provider, method,
  scope:  "user" | "workspace",   // workspace only where method.poolable
  ownerId, secretRef, label
}

resolve(session) =
  credential(user, provider)                // their own seat wins
    ?? workspaceCredential(provider)        // the team's metered key
    ?? PromptToConnect(provider)
```

Two things follow that are easy to skip and expensive to retrofit. Show **which**
credential a session ran on, in the session header and on the PR it opens — both cost
attribution and licence compliance hang on it, and a session that silently fell back to
the team's metered key is a bill nobody expected. And never write one person's seat
credential into a home directory another person's session can read: inject per session
(Cursor, Claude's token), use the ephemeral store (Codex), and fall back to per-user
`CODEX_HOME` or `CLAUDE_CONFIG_DIR` only where the CLI insists on disk.

The practical default for a small studio: **everyone brings their own seat**. It is
flat-rate, it needs no team plan, and every provider supports it headlessly. Add a
workspace-scoped API key as the fallback lane — for CI, for scheduled work with no human
owner, and for anyone not yet connected.

---

## 5. What six developers would pay on API keys

Anthropic publishes the figure, which beats any estimate built from scratch: across
enterprise deployments the average is **about $13 per developer per active day and
$150–250 per developer per month**, with 90% of users staying under $30 per active day.
For six people that is **$900–1,500 a month** at moderate usage.

### Where the money actually goes

The session breakdown from Anthropic's own docs, priced out — a six-minute Sonnet session
costing $0.55:

| Token class | Count | Rate | Cost | Share |
| --- | --- | --- | --- | --- |
| Cache read | 940,000 | $0.30 / MTok | $0.282 | 51% |
| Cache write | 50,000 | $3.75 / MTok | $0.188 | 34% |
| Output | 5,300 | $15.00 / MTok | $0.080 | 14% |
| Fresh input | 1,200 | $3.00 / MTok | $0.004 | 1% |

**85% of the bill is re-reading context, not generating code.** Cost tracks conversation
length times number of turns, which is why clearing between tasks saves more than any
prompt you could shorten, and why a session left open all day is expensive even when
nobody is typing.

### Three scenarios, six developers

| Usage | Per dev / active day | Per dev / month | Team of 6 / month |
| --- | --- | --- | --- |
| Light — a couple of hours, Sonnet | ~$4 | $60–90 | $360–540 |
| **Moderate** — most of the workday, Sonnet default | ~$13 | $150–250 | **$900–1,500** |
| Heavy — Opus default, long sessions | ~$30 | $450–600 | $2,700–3,600 |

**Background sessions are additive.** Those figures are for interactive work. Every
background session byconvo fires is a full context of its own and costs what a
human-driven session costs. Six developers each kicking off three background tasks a day
adds roughly **$750–1,300 a month** on top. Budget for it explicitly — it is the line
item that surprises people, because the sessions run while nobody is watching the meter.

### Rates, for your own arithmetic

| Model | Input | Output | Cache read | Cache write |
| --- | --- | --- | --- | --- |
| Claude Opus 5 | $5.00 | $25.00 | $0.50 | $6.25 |
| Claude Sonnet 5 | $3.00 | $15.00 | $0.30 | $3.75 |
| Claude Haiku 4.5 | $1.00 | $5.00 | $0.10 | $1.25 |
| GPT-5.3-Codex (unverified) | $1.75 | $14.00 | ~$0.18 | n/a |

Per million tokens. Sonnet 5 runs introductory pricing at $2 / $10 until 31 August 2026 —
do not build a budget on it. The Codex row comes from secondary sources rather than
OpenAI's own pricing page; treat it as indicative. Cursor's plans are credit-based rather
than published per-token, so there is no reliable row for it.

### The comparison that should decide it

Six Max-tier seats run roughly $600–1,200 a month, flat, with no metering. Six developers
on API keys at moderate usage run $900–1,500 *plus* background sessions. **For steady
interactive work, seats win, usually by a wide margin.**

Which points at the hybrid — and it is the same split the credential model already draws:
**seats for the humans, one workspace API key for the machines.** Background and scheduled
sessions are where a metered key earns its keep: they have no human owner to attribute a
seat to, and running them on someone's seat burns the five-hour rolling allowance their
interactive work depends on. A background agent that exhausts a developer's window has
cost more than the tokens it spent.

### Levers, in order of effect

- **Clear between tasks.** 85% of spend is context re-reads, so a fresh session is the
  single biggest saving available.
- **Sonnet as the default, Opus for hard problems.** Roughly 40% off the same work.
- **Haiku for subagents** — a tenth of Opus, and adequate for the read-heavy delegated
  work byconvo would fan out.
- **Batch API for anything not latency-sensitive** — 50% off, which fits scheduled
  background runs precisely.
- **Watch cache TTL on API keys.** The prompt cache lives five minutes on an API key
  against an hour on a subscription, so a background agent that pauses between turns
  re-pays full price for its whole context. Measure it before scaling the fleet.

If you do go the API route, request rate limits up front. Anthropic's guidance for a 5–20
person team is 100–150k TPM per user, so budget around **600–900k TPM** org-wide — and
those limits are shared across the organisation, so a box running six parallel background
sessions competes with the humans for them.

---

## 6. Sharp edges

These are the constraints that decide the design, roughly in order of how much trouble
they cause.

1. **A credential store is per-user, not per-session.** `~/.claude/.credentials.json`,
   `$CODEX_HOME/auth.json`, `~/.local/share/opencode/auth.json` and Cursor's config are
   all one-per-home-directory. If two people share a box, they share seats. Anthropic's
   terms do not permit sharing a personal account, and Anthropic has publicly tied rate
   limit changes to enforcement against account sharing and resale. **One box per
   person** — or at minimum one Linux user per person with per-user
   `CLAUDE_CONFIG_DIR` / `CODEX_HOME`. Anthropic's self-hosted runners reach the same
   conclusion: a runner locks to one account.

2. **Refresh-token rotation punishes credential copying.** Covered above for Codex; the
   same class of failure applies wherever OAuth is in play. Authorize each machine
   separately. Device-code and `setup-token` flows exist precisely for this.

3. **Concurrent sessions in one checkout will collide.** Every one of these CLIs is
   cwd-scoped. Give each session its own `git worktree` on its own branch. byconvo's
   `ChatOrigin.repoPath` is already per-chat, so this is a value change, not a schema
   change.

4. **`fullAccess` means something different on a box.** Locally,
   `--dangerously-skip-permissions` / `--dangerously-bypass-approvals-and-sandbox` /
   `--force` means "my laptop". On a shared box it means any session can read every
   other subscription's credentials sitting in the adjacent home directory. byconvo's
   catalog currently defaults `access` to `fullAccess`; that default should not follow a
   session onto a remote runner unchecked. Keep the provider sandboxes on (`--full-auto`,
   `--sandbox`), run sessions as a non-root user, and put credentials outside the
   sandbox where you can — which is exactly what Anthropic does: "sensitive credentials
   such as git credentials or signing keys are never inside the sandbox."

5. **Git credentials should be minted, not stored.** A long-lived PAT on a box that runs
   arbitrary agent-authored shell commands is the whole repository in one file. Prefer
   short-lived per-session tokens, or proxy git the way Anthropic's git proxy does.

6. **`$SHELL -l -c` is wrong on a server.** `inLoginShell()` exists because a GUI-launched
   app misses the developer's PATH. A box has a known, provisioned PATH; the login-shell
   wrapper there just re-introduces rc-file noise into a parsed stream. Remote runners
   should use a fixed shell and explicit PATH.

7. **Session-id capture has to run where the CLI runs.** `agent-session-capture.ts`
   scans the CLI's own session files to recover `discovered` ids for codex and opencode.
   On a remote runner that scan must happen on the runner. Same for
   `modelDiscoveryCommand` — otherwise the model picker shows the laptop's models, not
   the box's.

8. **Rate limits are per account, not per box.** Six parallel sessions do not multiply
   your quota; they divide it. Codex exposes `account/rateLimits/read` and Claude's cloud
   docs say parallel sessions consume limits proportionately. The session picker should
   show remaining quota per provider, not just "box online".

9. **The stream has to survive the WAN.** byconvo already has the right shape here — the
   turn runtime lives outside Effect, keeps running without a socket, and broadcasts to
   watchers with a heartbeat that reaps half-open sockets. That design is what makes a
   remote runner viable; it just needs the same treatment applied between byconvo and
   the box, not only between browser and server.

10. **The review loop needs a repo identity that isn't a local path.**
    `layers/github/github-client.ts` resolves owner/repo from the *selected local repo's*
    `origin`. Reviewing a PR that a remote box produced means either keeping a local
    clone selected, or letting the GitHub layer take a repo identity supplied by the
    runner.

---

## 7. Recommended shape for byconvo

**Put the seam at the process boundary, not the provider boundary.** That is the whole
argument: `providers.ts` and the four stream parsers stay untouched, and every provider
gains remote execution at once.

Define a `ProcessHost` port next to the existing `ports/terminal-exec.ts` and
`ports/git-exec.ts`:

```
spawn(program: ChatTurnProgram) -> { stdout, stderr, stdin, kill }
writeTempFile(bytes) -> path          // dropped images
recentAgentSessions(since) -> ids     // discovered session ids
gitExec(args) -> string
worktreeCreate(repo, branch) -> path
```

Local implementation is today's `node:child_process`. Remote implementation is a small
byconvo agent daemon on the box (or plain SSH to start with). Add a `Runner` alongside
`ChatOrigin` on the chat record — `{ id, label, kind: "local" | "remote", endpoint,
capabilities }` — which is presumably what the empty `packages/central-server` package is
reserved for.

**Ship it in this order.**

1. **Run byconvo's own embedded-server on the box.** `packages/spa/src/lib/api/client.ts`
   already reads `window.byconvo.apiBaseUrl` and derives every WebSocket URL from it, so
   the SPA can point at a remote origin today. The box has git, the checkouts, the CLIs
   and the credentials; nothing about chats, threads, review or Local Dev changes. Add
   auth and TLS in front, and make the desktop shell a multi-server client. This gets
   you "background agent sessions" with almost no new concepts — a byconvo server that
   isn't your laptop.
2. **Per-session worktrees and a `byconvo/<chat-id>` branch**, so parallel sessions stop
   colliding and every session already has a branch to push.
3. **Push and open the PR** from the runner, through the existing `GitHubClient`. The
   review side of the loop already exists — `layers/github` reads pulls, diffs, comments
   and replies, and the SPA renders them.
4. **Upgrade transports where they pay for themselves**, provider by provider:
   opencode → `opencode serve` + SDK (drop the parser entirely); codex →
   `codex app-server` over a unix socket, proxied, which brings approvals, rate limits
   and device-code login into byconvo's UI; claude and cursor → keep `-p` streaming JSON,
   which is the supported programmatic path for both.
5. **Offer provider-native cloud as a separate runner kind**, not as a replacement:
   Cursor Cloud Agents for fire-and-forget PR tasks, Claude Code cloud sessions where
   the account has them, Codex Cloud via `codex cloud`. These need no box at all, but
   you give up control of the environment and you cannot mix providers under one model.

---

## 8. What the architecture cannot do

- **Several people working off one Claude or ChatGPT seat.** Prohibited, and actively
  enforced. Note the scope: it is the *seat* that cannot be shared, not the machine.
  Several people each running their own seat on one box is fine — see section 3.
- **Routing a Claude Pro/Max subscription into opencode or another third-party client.**
  Explicitly prohibited; opencode unbundled the plugins that did it in 1.3.0.
- **Sharing one credential file between laptop and box.** Refresh-token rotation breaks
  it, non-deterministically.
- **`claude setup-token` plus Remote Control.** The long-lived token can only make model
  requests; it cannot establish Remote Control sessions or fetch claude.ai connectors.
- **Codex device login where the server has it disabled.** The CLI reports "device code
  login is not enabled for this Codex server"; a business workspace may need an admin to
  enable it before a box can be authorized that way.
- **A browser talking directly to `codex app-server` over WebSocket.** Any request with
  an `Origin` header is rejected. Proxy it server-side.
- **Claude Code cloud sessions on API-key auth or a third-party inference provider.**
  Bedrock, Vertex/Agent Platform and Foundry configurations cannot use `--cloud` or
  `--teleport`.

---

## Sources

- Claude Code — [Authentication](https://code.claude.com/docs/en/authentication),
  [Run Claude Code programmatically](https://code.claude.com/docs/en/headless),
  [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web),
  [Self-hosted environments](https://code.claude.com/docs/en/self-hosted-environments)
- Codex — source read at [`openai/codex`](https://github.com/openai/codex):
  `codex-rs/app-server/README.md`, `codex-rs/exec-server/README.md`,
  `codex-rs/login/src/auth/{storage,manager}.rs`, `codex-rs/cli/src/main.rs`,
  `sdk/typescript/README.md`
- opencode — source read at [`sst/opencode`](https://github.com/sst/opencode):
  `packages/web/src/content/docs/{server,providers,acp,github,enterprise,network}.mdx`
- Costs — Claude Code [Manage costs effectively](https://code.claude.com/docs/en/costs);
  model rates from the bundled Claude API pricing reference (cached 2026-06-24)
- Cursor — [CLI overview](https://cursor.com/docs/cli/overview),
  [Headless CLI](https://cursor.com/docs/cli/headless),
  [CLI authentication](https://cursor.com/docs/cli/reference/authentication),
  [Cloud Agents API](https://cursor.com/docs/cloud-agent/api/endpoints)
