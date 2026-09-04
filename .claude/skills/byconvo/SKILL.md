---
name: byconvo
description: Fetch the review comments left in the byconvo tool — local inline comments on files, commits and ranges, and the comments on the GitHub pull request or GitLab merge request being reviewed — implement each suggestion in the codebase, then mark it done. Use when the user asks to "apply review comments", "implement the review", "address the comments I left", "address the MR comments", or similar.
---

## What this does

The byconvo tool lets a human leave inline review comments on files (like GitHub
code review), on the working tree, a specific commit, or a commit range. They are
saved in byconvo's local database (`~/.byconvo/byconvo.db`), scoped to the
repository they were left in.

The byconvo server exposes them over HTTP. This skill walks you through fetching
them, implementing each one in the code, and **resolving** it — which in byconvo
means deleting it via the API — once done so it isn't applied twice.

Comments carry a `source` saying where they live:

- `"local"` — byconvo's own database on this machine. Yours to implement and to
  resolve (resolving is deleting; see below).
- `"github"` / `"gitlab"` — a live thread on the pull request or merge request
  being reviewed. Also yours to implement, but they are somebody else's record:
  answer them with a reply rather than deleting them. See
  "Comments on a pull or merge request".

## The API

The server listens on `http://localhost:41811` by default (override with
`$BYCONVO_PORT`). It serves the currently *selected* repository — make sure that's
the repo you're working in (it's seeded from `BYCONVO_REPO` / the cwd the server
was started in). Interactive docs: `http://localhost:41811/api/docs`.

- `GET /api/comments` → array of local code comments
- `DELETE /api/comments/:id` → `{ "ok": true }` (fully removes one comment).

Deleting **is** how a comment is resolved in byconvo — there is no separate
"resolved" flag; a resolved comment is a deleted one.

A comment looks like:

```json
{
  "id": "c-lx9f2a-3",
  "filePath": "src/server/auth.ts",
  "side": "additions",
  "lineNumber": 42,
  "body": "Extract this into a helper and add a null check.",
  "author": "you",
  "createdAt": "2026-06-14T18:20:00.000Z",
  "target": "worktree",
  "source": "local"
}
```

Field meaning:
- `filePath` — repo-relative path the comment is anchored to.
- `lineNumber` — the line in that file the comment points at.
- `side` — which side of the diff the line is on: `"additions"` = the new/current
  code (right side; this is the usual case), `"deletions"` = the old/removed code
  (left side).
- `body` — the reviewer's instruction. **This is the change to make.**
- `target` — which diff the comment was left on: `"worktree"` for the working
  tree, `"commit-<sha>"` for a comment left in the commit view, or `"<base>...<head>"`
  for a range. Informational — you resolve every local comment the same way
  regardless of its target.

## Workflow

1. **Fetch** the local comments:
   ```bash
   curl -s http://localhost:41811/api/comments | jq '[.[] | select(.source == "local")]'
   ```
   If the call fails, the byconvo server probably isn't running — tell the user to
   start it (`pnpm dev`) rather than guessing.

2. **Locate the code** each comment points at: group by `filePath` and open each
   at `lineNumber`.

3. **Implement** the change described in `body`. Treat `body` as a concrete
   instruction. If a comment is genuinely ambiguous or conflicts with another,
   ask the user instead of guessing — don't silently skip it.

4. **Resolve it** only after the change is in place, by deleting it via the API —
   this fully removes the comment (byconvo has no separate "resolved" state):
   ```bash
   curl -s -X DELETE http://localhost:41811/api/comments/<id>
   ```
   Do this for each comment individually, immediately after you finish
   implementing it — not in a batch at the end. That way a half-finished run still
   reflects real progress, and no comment gets applied twice.

5. **Verify** once all comments are handled: run the project's typecheck/tests
   (`pnpm typecheck`, `pnpm --filter @byconvo/embedded-server test`, etc.) and report what
   you changed, file by file, with each comment's `body` you addressed.

## Comments on a pull or merge request

byconvo also reads the request open against this checkout — a **pull request**
when `origin` is on GitHub, a **merge request** when it is on GitLab. It works
the same either way: the server reads `origin` when the repository is opened and
talks to whichever forge that is, so nothing here is configured per project.

Which forge (if any) is answering:

```bash
curl -s http://localhost:41811/api/repo | jq .remote
# {"host":"gitlab","hostname":"gitlab.com","owner":"acme/team","repo":"app", ...}
# null → origin is on neither forge, and the endpoints below have nothing to serve.
```

The endpoints are the same for both. `:number` is the request's own number —
GitHub's `#12`, GitLab's `!12` (its `iid`):

| Call | What it does |
| --- | --- |
| `GET /api/reviews/pulls` | Every open request, with CI, mergeability, labels and who is on it |
| `GET /api/reviews/pulls/:number/diff` | Its diff, as unified diff text |
| `GET /api/reviews/pulls/:number/comments` | Its line comments, as `ReviewComment`s |
| `POST /api/reviews/pulls/:number/comments` | Leave one: `{filePath, side, lineNumber, body}` |
| `POST /api/reviews/pulls/:number/comments/:commentId/replies` | Reply in that comment's thread: `{body}` |
| `DELETE /api/reviews/pulls/:number/comments/:commentId` | Remove a comment (only your own; the forge refuses others) |

`:commentId` is the comment's `id` **without** its source prefix — `gh-123456`
is passed as `123456`, and GitLab's `gl-<discussion>-<note>` as
`<discussion>-<note>`. Pass it exactly as the id gives it; it is the forge's own
name for the comment, not a number to reconstruct.

So, to catch the comments people have left on the request being reviewed:

```bash
NUM=$(curl -s http://localhost:41811/api/reviews/pulls | jq '.[0].number')
curl -s "http://localhost:41811/api/reviews/pulls/$NUM/comments" | jq .
```

Working through them:

1. Implement each `body` at `filePath:lineNumber`, exactly as for a local one.
2. **Reply** in its thread to say what you did, instead of deleting it — the
   thread is the reviewer's record and other people are reading it:
   ```bash
   curl -s -X POST \
     "http://localhost:41811/api/reviews/pulls/$NUM/comments/<id-without-prefix>/replies" \
     -H 'content-type: application/json' -d '{"body":"Renamed it — 3a1f9c2."}'
   ```
3. Never delete a comment you did not write. The forge refuses it anyway, and
   the refusal comes back as its own sentence about why.

Authentication is the forge's usual one, read from the environment by the
server: `GITHUB_TOKEN` / `GH_TOKEN` (or `gh auth token`) for GitHub,
`GITLAB_TOKEN` (or `glab auth token`) for GitLab. Without one, a private project
answers with nothing — if a call comes back 401/403/404, say so rather than
concluding the request has no comments.

## Sending comments to a session

Comments — local or from the request — can be handed to an agent session
instead of being implemented here. In the app that is the "assign" action on the
review pane; over the API it is two calls:

```bash
CHAT=$(curl -s -X POST http://localhost:41811/api/chats \
  -H 'content-type: application/json' \
  -d '{"title":"Fix 3 review comments"}' | jq -r .id)

curl -s -X POST "http://localhost:41811/api/chats/$CHAT/messages" \
  -H 'content-type: application/json' \
  -d '{"text":"Address these review comments in the codebase:\n\nsrc/a.ts:12 - Fix this"}'
```

`POST /api/chats` takes an optional `provider`, `model`, `effort`, `access` and
`branch`; omitted, the session starts on the user's own defaults
(`GET /api/chats/models` lists them). The turn streams over the session's
WebSocket; `GET /api/chats/:id` reads the messages back afterwards.

One line per comment — `filePath:lineNumber - body` — is the format the app
itself sends, and it is what the receiving session expects to work from. Local
comments handed off this way are deleted (the hand-off is the resolution);
comments on a request are not — reply in their thread once the session's work
lands.

## Verifying in the browser

byconvo's window has a browser pane (the globe at the right of the window bar).
When it is open you can drive the page it is showing and read what it renders —
this is how you check a DOM change actually landed instead of assuming it did.

**Always call `state` first.** It is the only endpoint that never fails:

```bash
curl -s http://localhost:41811/api/browser/state
```

`{"connected": false, ...}` means the human has not opened the pane. Say so and
carry on without it — do not try to work around it, and do not ask them to open
it unless seeing the page is genuinely the only way to finish the task. Every
other endpoint answers `503 BrowserUnavailable` in that situation.

| Call | What it does |
| --- | --- |
| `GET /api/browser/state` | `{connected, url, title, loading}` |
| `POST /api/browser/navigate` `{"url": "localhost:3000/settings"}` | Loads a page; a bare host is read as http |
| `GET /api/browser/snapshot?selector=<css>` | `{url, title, selector, html, text}` for that subtree (whole document when omitted) |
| `POST /api/browser/eval` `{"script": "..."}` | Runs JS in the page; `{"json": "<result as JSON>"}` |
| `GET /api/browser/console` | Recent console messages, cleared on each navigation |
| `GET /api/browser/screenshot` | `{"dataUrl": "data:image/png;base64,..."}` of the viewport |

A typical check after changing a component:

```bash
curl -s -X POST http://localhost:41811/api/browser/navigate \
  -H 'content-type: application/json' -d '{"url":"localhost:3000"}'
curl -s 'http://localhost:41811/api/browser/snapshot?selector=%23sidebar' | jq -r .text
curl -s http://localhost:41811/api/browser/console | jq '[.[] | select(.level=="error")]'
```

The pane shows whatever the user pointed it at — usually their own dev server,
which **they** run, not you. If the page 404s or refuses to connect, report that;
don't start a dev server yourself.

## Notes

- Never delete a comment you didn't implement — deletion is the "resolved" signal,
  and it's irreversible (the comment is gone for good, not archived).
- If you can't implement a comment, leave it in place and tell the user why.
- Comments persist per-repo in byconvo's database, so they survive restarts;
  only your DELETE removes them. Read them through the API above — the database
  is byconvo's to write.
- A comment on a pull or merge request lives on the forge, not here: it survives
  everything you do locally, and the only way to answer it is a reply in its
  thread.
