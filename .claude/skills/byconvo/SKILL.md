---
name: byconvo
description: Fetch the local review comments left in the byconvo tool — both inline code comments and visual comments clicked onto DOM elements in a running app — and implement each suggestion in the codebase, then mark it done. Use when the user asks to "apply review comments", "implement the review", "address the comments I left", or similar.
---

## What this does

The byconvo tool lets a human leave review comments two ways:

- **Code comments** — inline on files (like GitHub code review), on the working
  tree, a specific commit, or a commit range. Saved in `.byconvo/comments.json`.
- **Visual comments** — left by clicking an element in a locally-running app with
  byconvo's injected picker. Anchored to a DOM element rather than a line. Saved
  in `.byconvo/visual-comments.json`.

The byconvo server exposes both over HTTP. This skill walks you through fetching
them, implementing each one in the code, and **resolving** it — which in byconvo
means deleting it via the API — once done so it isn't applied twice.

Only **local** code comments (`"source": "local"`) are yours to implement.
Comments with `"source": "github"` come live from a GitHub PR — leave them alone.
Visual comments are always local, so every one of them is yours.

## The API

The server listens on `http://localhost:41811` by default (override with
`$BYCONVO_PORT`). It serves the currently *selected* repository — make sure that's
the repo you're working in (it's seeded from `BYCONVO_REPO` / the cwd the server
was started in). Interactive docs: `http://localhost:41811/api/docs`.

- `GET /api/comments` → array of code comments
- `DELETE /api/comments/:id` → `{ "ok": true }` (fully removes one comment).
- `GET /api/visual-comments` → array of visual comments
- `DELETE /api/visual-comments/:id` → `{ "ok": true }`

Deleting **is** how a comment is resolved in byconvo — there is no separate
"resolved" flag; a resolved comment is a deleted one. This holds for both kinds.

A code comment looks like:

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

A visual comment looks like:

```json
{
  "id": "v-lx9f2a-3",
  "body": "This save button should be primary and full-width on mobile.",
  "author": "you",
  "createdAt": "2026-07-25T11:10:09.317Z",
  "pageUrl": "http://localhost:3000/settings",
  "pageTitle": "Settings",
  "route": "/settings",
  "selector": "main > form > button:nth-of-type(2)",
  "label": "<SettingsForm> button#save.btn \"Save changes\"",
  "tagName": "button",
  "elementText": "Save changes",
  "elementHtml": "<button id=\"save\" class=\"btn\">Save changes</button>",
  "rect": { "x": 10, "y": 20, "width": 80, "height": 32 },
  "viewport": { "width": 1440, "height": 900 },
  "sourceFile": "src/components/settings-form.tsx",
  "sourceLine": 42
}
```

Field meaning:
- `body` — the reviewer's instruction. **This is the change to make.**
- `sourceFile` / `sourceLine` — where the element was rendered from, when the
  app's dev tooling exposed it. **Optional and best-effort** — present it is the
  fastest route to the right code, absent you must locate the element yourself.
- `label` — the element as the reviewer saw it. The `<Component>` prefix, when
  present, is the React component that rendered it — usually the best thing to
  grep for when `sourceFile` is missing.
- `elementText` / `elementHtml` — the element's visible text and a truncated
  slice of its markup. Grep the codebase for these to find the source.
- `route` / `pageUrl` — the page the element was on. Maps to a route file in most
  frameworks.
- `selector` — a CSS path for re-finding the element in the live DOM. Rarely
  useful for locating source; it identifies the node, not the code.

To find the code behind a visual comment, try in order: `sourceFile`, then the
component name in `label`, then grep for `elementText` / a distinctive class from
`elementHtml`, then the route.

## Workflow

1. **Fetch** both kinds — don't stop at the first, the user rarely says which
   kind they left:
   ```bash
   curl -s http://localhost:41811/api/comments | jq '[.[] | select(.source == "local")]'
   curl -s http://localhost:41811/api/visual-comments
   ```
   If the calls fail, the byconvo server probably isn't running — tell the user to
   start it (`pnpm dev`) rather than guessing.

2. **Locate the code** each comment points at.
   - Code comments: group by `filePath` and open each at `lineNumber`.
   - Visual comments: follow the `sourceFile` → component name → `elementText`
     search order above until you find the element's source.

3. **Implement** the change described in `body`. Treat `body` as a concrete
   instruction. If a comment is genuinely ambiguous or conflicts with another,
   ask the user instead of guessing — don't silently skip it.

4. **Resolve it** only after the change is in place, by deleting it via the API —
   this fully removes the comment (byconvo has no separate "resolved" state):
   ```bash
   curl -s -X DELETE http://localhost:41811/api/comments/<id>
   curl -s -X DELETE http://localhost:41811/api/visual-comments/<id>
   ```
   Use the endpoint matching the kind — the two id spaces are separate (code ids
   start `c-`, visual ids start `v-`). Do this for each comment individually,
   immediately after you finish implementing it — not in a batch at the end. That
   way a half-finished run still reflects real progress, and no comment gets
   applied twice.

5. **Verify** once all comments are handled: run the project's typecheck/tests
   (`pnpm typecheck`, `pnpm --filter @byconvo/embedded-server test`, etc.) and report what
   you changed, file by file, with each comment's `body` you addressed.

## Notes

- Never delete a comment you didn't implement — deletion is the "resolved" signal,
  and it's irreversible (the comment is gone for good, not archived).
- If you can't implement a comment, leave it in place and tell the user why.
- Comments persist per-repo in `.byconvo/comments.json` and
  `.byconvo/visual-comments.json`, so they survive restarts; only your DELETE
  removes them.
- A visual comment's `rect` and `viewport` describe where the element sat when the
  comment was left. Treat them as context for a layout complaint, not as values to
  hard-code.
