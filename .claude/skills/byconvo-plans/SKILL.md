---
name: byconvo-plans
description: Work out how something in this codebase actually works and record it as an analysis in byconvo's Plans pane — a front-to-back flow graph with notes anchored to real files and lines. Use when asked to "analyse how X works", "draw the flow for X", "record an analysis", or when a byconvo Plans request arrives.
---

## What this does

byconvo's Plans pane draws an **analysis**: a graph of how one piece of
behaviour travels through the codebase, laid out from the frontend to the
backend, with notes pinned to the places a reader would otherwise have to go
digging for.

You produce one by reading the code and POSTing it to the byconvo server. The
human then reads it in the pane, clicks through to the files, and leaves notes
back on it.

The server listens on `http://localhost:41811` (override with `$BYCONVO_PORT`)
and serves the currently selected repository. Interactive docs:
`http://localhost:41811/api/reference`.

## The one rule that matters

**Read the code first.** Every node and every note carries an `anchor` — a real
file and a real line — and the server fingerprints that line when it stores it.
An invented anchor does not merely look wrong; it makes the analysis report
itself as stale the moment anyone opens it. If you have not opened the file,
it does not get an anchor.

## Posting an analysis

`POST /api/plans` with:

```json
{
  "title": "How a new branch is created",
  "question": "analyse how a new branch is created",
  "nodes": [
    {
      "id": "button",
      "label": "New branch button",
      "layer": "frontend",
      "kind": "ui",
      "summary": "Opens the branch dialog from the git actions bar",
      "anchor": { "filePath": "packages/spa/src/components/git/branch-bar.tsx", "line": 42 },
      "order": 0
    },
    {
      "id": "create-branch",
      "label": "POST /api/branches",
      "layer": "transport",
      "kind": "route",
      "anchor": { "filePath": "packages/embedded-server/src/layers/repo/repo.api.ts", "line": 88 }
    },
    {
      "id": "git-branch",
      "label": "git branch <name>",
      "layer": "backend",
      "kind": "service",
      "anchor": { "filePath": "packages/embedded-server/src/layers/git/git-exec.ts", "line": 31 }
    }
  ],
  "edges": [
    { "from": "button", "to": "create-branch", "label": "submit", "kind": "call" },
    { "from": "create-branch", "to": "git-branch", "kind": "call" }
  ],
  "annotations": [
    {
      "nodeId": "git-branch",
      "body": "The ref name is validated here, not in the dialog — a name the UI accepts can still be rejected at this point.",
      "anchor": { "filePath": "packages/embedded-server/src/layers/git/git-exec.ts", "line": 34 }
    }
  ]
}
```

The response is the stored plan, including the id it was filed under.

### Fields

| Field | Meaning |
| --- | --- |
| `title` | What the pane's picker shows. A short noun phrase. |
| `question` | What you were asked, kept so a rerun knows what to redo. |
| `nodes[].id` | Yours to choose; only has to be unique within this analysis. |
| `nodes[].layer` | The lane. **This is the left-to-right order**: `entry`, `frontend`, `transport`, `backend`, `data`, `external`. |
| `nodes[].kind` | The glyph and tint: `ui`, `state`, `route`, `handler`, `service`, `store`, `process`, `external`. Defaults to `service`. |
| `nodes[].summary` | One line, shown in the box. Optional but nearly always worth it. |
| `nodes[].order` | Rank within the lane, top to bottom. Defaults to declaration order. |
| `nodes[].anchor` | `{ filePath, line }`, repo-relative POSIX path, one-based line. |
| `edges[].kind` | `call`, `data`, or `event` — `event` draws dashed. |
| `edges[].label` | What travels along it. Short: it sits on the wire. |
| `annotations[].nodeId` | The step the note belongs to, or omit for a note on the analysis as a whole. |

An edge naming a node that does not exist is dropped, and so is a duplicate
node id — so a malformed graph degrades rather than failing, which means you
should check the response rather than assume everything you sent survived.

### Laying it out well

- **One lane per tier, in travel order.** A request that goes UI → HTTP →
  service → git belongs in `frontend`, `transport`, `backend`, `data` — not all
  in `backend` because they are all server files.
- **Nodes are steps, not files.** If one file does two things at two points in
  the flow, that is two nodes.
- **Six to twelve nodes** is the readable range. Past that, analyse a narrower
  question.
- **Annotate the surprises**, not the obvious. "This handler validates" earns
  nothing; "validation happens here rather than in the dialog, so the UI can
  accept a name the server rejects" earns its place.

## The other endpoints

| Call | What it does |
| --- | --- |
| `GET /api/plans` | Summaries of every analysis, most recently touched first |
| `GET /api/plans/:id` | `{plan, staleness}` — the graph plus how well it still matches the working tree |
| `POST /api/plans/:id/annotations` | Add a note (`origin: "review"`) |
| `DELETE /api/plans/:id/annotations/:annotationId` | Remove one note |
| `POST /api/plans/:id/save` | Freeze it: review notes are dropped, findings stay |
| `DELETE /api/plans/:id` | Delete the analysis |

## Staleness, and when to rerun

`GET /api/plans/:id` returns a `staleness` report next to the plan. Each anchor
comes back as one of:

- `fresh` — the file is byte-for-byte the one that was analysed.
- `relocated` — the file changed, but the anchored line was found again; the
  resolution carries the line it is on now, and the pane follows it there.
- `lost` — the file changed and that line is gone.
- `missing` — the file itself is gone.

`needsRerun` is true once anything is `lost` or `missing`. **When you are asked
to rerun a stale analysis, post a new one** — do not try to patch the old one's
anchors. The point of the flag is that the codebase moved far enough that the
finding itself needs re-deriving.

## Reading the notes left on an analysis

The human's notes come back in the plan's `annotations` with `"origin":
"review"` (yours are `"analysis"`). Treat a review note as an instruction about
the code, the same way the `byconvo` skill treats an inline review comment —
implement it, then remove it with `DELETE /api/plans/:id/annotations/:id`.

Notes with `"origin": "analysis"` are your own findings. Leave them alone.

## Notes

- Analyses persist per-repo as one JSON document each under `.byconvo/plans/`,
  so they survive restarts and can be committed if the team wants them kept.
- If the API call fails, the byconvo server probably isn't running — say so
  rather than guessing; do not start it yourself.
