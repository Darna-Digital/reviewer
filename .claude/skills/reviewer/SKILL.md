---
name: reviewer
description: Fetch the local review comments left in the reviewer tool — inline code comments on files, commits and ranges — and implement each suggestion in the codebase, then mark it done. Use when the user asks to "apply review comments", "implement the review", "address the comments I left", or similar.
---

## What this does

The reviewer tool lets a human leave inline review comments on files (like GitHub
code review), on the working tree, a specific commit, or a commit range. They are
saved in reviewer's local database (`~/.reviewer/reviewer.db`), scoped to the
repository they were left in.

The reviewer server exposes them over HTTP. This skill walks you through fetching
them, implementing each one in the code, and **resolving** it — which in reviewer
means deleting it via the API — once done so it isn't applied twice.

Only **local** comments (`"source": "local"`) are yours to implement. Comments
with `"source": "github"` come live from a GitHub PR — leave them alone.

## The API

The server listens on `http://localhost:41811` by default (override with
`$REVIEWER_PORT`). It serves the currently *selected* repository — make sure that's
the repo you're working in (it's seeded from `REVIEWER_REPO` / the cwd the server
was started in). Interactive docs: `http://localhost:41811/api/docs`.

- `GET /api/comments` → array of code comments
- `DELETE /api/comments/:id` → `{ "ok": true }` (fully removes one comment).

Deleting **is** how a comment is resolved in reviewer — there is no separate
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
   If the call fails, the reviewer server probably isn't running — tell the user to
   start it (`pnpm dev`) rather than guessing.

2. **Locate the code** each comment points at: group by `filePath` and open each
   at `lineNumber`.

3. **Implement** the change described in `body`. Treat `body` as a concrete
   instruction. If a comment is genuinely ambiguous or conflicts with another,
   ask the user instead of guessing — don't silently skip it.

4. **Resolve it** only after the change is in place, by deleting it via the API —
   this fully removes the comment (reviewer has no separate "resolved" state):
   ```bash
   curl -s -X DELETE http://localhost:41811/api/comments/<id>
   ```
   Do this for each comment individually, immediately after you finish
   implementing it — not in a batch at the end. That way a half-finished run still
   reflects real progress, and no comment gets applied twice.

5. **Verify** once all comments are handled: run the project's typecheck/tests
   (`pnpm typecheck`, `pnpm --filter @reviewer/embedded-server test`, etc.) and report what
   you changed, file by file, with each comment's `body` you addressed.

## Verifying in the browser

reviewer's window has a browser pane (the globe at the right of the window bar).
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
- Comments persist per-repo in reviewer's database, so they survive restarts;
  only your DELETE removes them. Read them through the API above — the database
  is reviewer's to write.
