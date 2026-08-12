# capture-spa

Points a headless Chrome at the byconvo SPA running locally, captures the live
DOM and the CSS that actually applies to it, and writes JSON snapshots the
marketing site renders inside shadow roots — real interface, real type, real
syntax highlighting, no screenshot and no mock.

```bash
# the SPA needs to be running (pnpm dev in the repo root)
pnpm capture:home                        # the whole homepage, hero + 6 sections
pnpm capture:home --only plans           # just one entry
pnpm capture:spa --help                  # every option
pnpm capture:spa \
  --url http://localhost:41812/modes/collaboration \
  --focus .app-canvas \
  --out public/spa-snapshots/collaboration.json
```

Render one with `<SpaSnapshot src="/spa-snapshots/plans.json" … />`.

## Capturing part of the UI

`--selector` sets what is captured (default `.app-frame`); `--focus` sets what
is *shown*. The whole selector subtree is still captured either way, so every
rule that depends on an ancestor — `.dark`, the frame's own layout, inherited
custom properties — keeps applying, and only the framing narrows. Pass several
selectors to frame the box that spans them all:

```bash
--focus ".app-canvas, .app-canvas ~ div"   # the canvas together with the analysis pane
```

The homepage sections all frame `.app-canvas`: the app's working area without
the window bar.

## Choosing what is in the shot

The capture runs in a throwaway browser profile, so it shows the app as a first
run does. Three ways to compose a view, in order of preference:

- `--state <file.json>` — localStorage entries seeded before first paint.
  byconvo keeps its pane layout, widths and tabs in `byconvo-ui`, so this is how
  a shot gets the analysis pane open or the services dock tall. Nested objects
  are stringified for you; see `state/`.
- `--prepare <file.ts>` — awaited in the page after it settles. For anything
  that needs a real interaction; `prepare/open-comment.ts` opens the inline
  comment composer by hit-testing the diff gutter inside Pierre's shadow root.
  Throw from these to fail the capture loudly rather than ship a wrong shot.
- `--click [selector@]x,y` — a real browser click (hover first, so gutter
  affordances appear), offset from an element's top-left corner or absolute in
  the viewport.

Prefer URL and state over clicks: `?file=…` opens a file, a commit sha browses
that commit, and neither can drift the way a coordinate can.

## The manifest

`home.json` is the homepage set — `{ defaults, captures }`, where each capture
takes the same options as the flags (camelCase: `waitFor`, `clicks`). One
browser serves the whole run.

Two things to know when adding entries:

- **Local changes are whatever is uncommitted at capture time** — including the
  snapshots this tool writes. Point shots at a commit or at browse mode rather
  than at the local-changes view, or a 1.4mb JSON diff ends up in the shot.
- **The browser pane is desktop-only** (`isDesktop`), so it cannot be captured
  from the SPA in a browser.

## What the capture does

- **Both schemes.** Runs twice with `prefers-color-scheme` emulated and the
  app's stored theme seeded, so a visitor in dark mode gets the dark app.
- **Prunes the CSS** to the rules that match the captured subtree — a 206kb
  stylesheet lands at ~40kb.
- **Resolves media, `@supports` and viewport units** at capture time, so the
  snapshot keeps the layout it was captured at whatever the visitor's window is.
- **Scopes `html`/`body`/`:root`** onto stand-in wrappers, using attribute
  selectors so `:root` keeps its weight against the `.dark` overrides.
- **Follows shadow DOM.** The file tree and Pierre diff panes are web
  components; their trees are re-emitted as declarative shadow roots and their
  stylesheets stored once each and re-adopted on render.
- **Freezes live state** that markup alone would lose: canvases become images,
  field values and scroll offsets are carried over, assets are inlined.

Fonts are skipped by default because the site already serves Inter; pass
`--fonts inline` for a page that needs a face the site does not have.
