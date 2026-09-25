---
name: resolve-reviewer-comments
description: Fetch the inline review comments left in the Reviewer Mac app (reviewer.sh) for the current repository, implement each one in the code, and resolve it in Reviewer. Use when the user asks to "resolve reviewer comments", "apply my review comments", "implement the review", "address the comments I left in Reviewer", or similar.
---

# Resolve Reviewer comments

[Reviewer](https://github.com/Darna-Digital/reviewer) is a Mac app for reviewing
code. Its user leaves inline comments on lines of the working tree, of a commit,
of a commit range or of the diff against another branch. Those comments are the
instructions for this task: implement each one, then resolve it so Reviewer
shows it as handled.

## The API

Reviewer runs a local API server at `http://127.0.0.1:41811` (or the port in
`$REVIEWER_PORT`, if set). Always pass `repo` — the root of the repository you
are working in — so you get that repository's comments no matter which project
the Reviewer window has open. Any path inside the repository works.

List the comments:

```bash
curl -sfG http://127.0.0.1:41811/api/comments \
  --data-urlencode "repo=$(git rev-parse --show-toplevel)"
```

Resolve one comment:

```bash
curl -sfG -X DELETE "http://127.0.0.1:41811/api/comments/<id>" \
  --data-urlencode "repo=$(git rev-parse --show-toplevel)"
```

Resolving returns `{"ok":true}`. If curl can't connect, Reviewer isn't
running — ask the user to open it, and stop. Don't guess other ports or read
Reviewer's database.

## A comment

```json
{
  "id": "c-lx9f2a-3",
  "filePath": "src/server/auth.ts",
  "side": "additions",
  "lineNumber": 42,
  "body": "Extract this into a helper and add a null check.",
  "author": "Ada",
  "createdAt": "2026-06-14T18:20:00.000Z",
  "target": "worktree",
  "source": "local"
}
```

- `body` — the reviewer's instruction. **This is the change to make.**
- `filePath` — repository-relative path the comment is anchored to.
- `lineNumber` — the line it points at, on the side given by `side`.
- `side` — `"additions"` is the new/current code (the usual case);
  `"deletions"` is the old, removed code on the left of the diff.
- `target` — the diff the comment was left on:
  - `"worktree"` — the working tree; the line numbers match the files on disk.
  - `"branch-<ref>"` — the local changes read against another branch.
  - `"commit-<sha>"` — one commit; the lines are that commit's version.
  - `"<base>...<head>"` — a commit range.

  For anything but `worktree`, the code may have moved since. Read the file at
  that version (`git show <sha>:<filePath>`) to see exactly what was pointed at,
  then find the same code in the working tree and change it there.

## Workflow

1. **Fetch** the comments. If there are none, say so and stop.
2. **Plan** — group the comments by `filePath`, read each file around
   `lineNumber`, and understand what every `body` asks for before editing.
   If a comment is ambiguous or contradicts another, ask the user rather than
   guessing — and don't silently skip it.
3. **Implement** each comment as a concrete instruction, matching the style of
   the surrounding code.
4. **Resolve** each comment right after its change is in place — one request
   per comment, not a batch at the end. A run that stops halfway then still
   reflects real progress, and nothing gets applied twice.
5. **Verify** — run the project's usual checks (typecheck, lint, tests) and
   report what changed, file by file, quoting each comment's `body`.

## Rules

- Resolving **deletes** the comment in Reviewer — there is no separate
  "resolved" state and no undo. Only resolve a comment you actually
  implemented.
- If you can't implement a comment, leave it in place and tell the user why.
- Don't create, edit or reword comments; they are the user's.
