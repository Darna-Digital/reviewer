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

The comments live behind the API server Reviewer embeds. Talk to it only
through the bundled helper — it finds the right server (every Reviewer window
runs its own, on its own port) and never switches the project a window has
open.

## The helper

`scripts/reviewer.mjs` sits next to this file. Run it with Node 18+ from inside
the repository you are working in; resolve its path relative to this
`SKILL.md`.

```bash
node <skill-dir>/scripts/reviewer.mjs server               # which server holds this repo
node <skill-dir>/scripts/reviewer.mjs list                 # the local comments to implement
node <skill-dir>/scripts/reviewer.mjs resolve <id> [<id>…] # resolve comments once implemented
```

Pass `--repo <path>` to target a repository other than the working directory.
Output is JSON on stdout. On failure the helper exits non-zero with a message on
stderr saying what the user needs to do — relay it and stop; do not guess
ports, call the API by hand, or read Reviewer's database.

The common failures:

- **No Reviewer server is running** — ask the user to open Reviewer.
- **No Reviewer window has this repository open** — ask the user to open it in
  Reviewer. The message lists the windows' projects. Never change a window's
  project yourself.

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
- `source` — `list` only returns `"local"` comments. `"github"` ones (shown with
  `list --all`) are read live from a pull request and cannot be resolved here;
  leave them alone.

## Workflow

1. **Fetch** — `list`. If it is empty, say so and stop.
2. **Plan** — group the comments by `filePath`, read each file around
   `lineNumber`, and understand what every `body` asks for before editing.
   If a comment is ambiguous or contradicts another, ask the user rather than
   guessing — and don't silently skip it.
3. **Implement** each comment as a concrete instruction, matching the style of
   the surrounding code.
4. **Resolve** each comment right after its change is in place — one
   `resolve <id>` per comment, not a batch at the end. A run that stops halfway
   then still reflects real progress, and nothing gets applied twice.
5. **Verify** — run the project's usual checks (typecheck, lint, tests) and
   report what changed, file by file, quoting each comment's `body`.

## Rules

- Resolving **deletes** the comment in Reviewer — there is no separate
  "resolved" state and no undo. Only resolve a comment you actually
  implemented.
- If you can't implement a comment, leave it in place and tell the user why.
- Don't create, edit or reword comments; they are the user's.
