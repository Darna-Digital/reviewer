# capture-spa

Points a headless Chrome at a byconvo SPA page running locally, captures the
live DOM and the CSS that actually applies to it, and writes a JSON snapshot the
marketing site renders inside a shadow root — real interface, real type, real
syntax highlighting, no screenshot and no mock.

```bash
# the SPA needs to be running (pnpm dev in the repo root)
pnpm capture:hero                      # the homepage hero, light + dark
pnpm capture:spa --help                # every option
pnpm capture:spa \
  --url http://localhost:41812/modes/collaboration \
  --out public/spa-snapshots/collaboration.json
```

Render it with `<SpaSnapshot src="/spa-snapshots/hero.json" … />`.

## What the capture does

- **Both schemes.** Runs twice with `prefers-color-scheme` emulated and the
  app's stored theme seeded, so a visitor in dark mode gets the dark app.
- **Prunes the CSS** to the rules that match the captured subtree — a 206kb
  stylesheet lands at ~45kb.
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

## Choosing what is in the shot

The capture runs in a throwaway browser profile, so it shows the app as a first
run does. To capture a specific view, pass `--state` a JSON file of
localStorage entries, and `--prepare` a JS file that is awaited in the page
before the shot (click a folder open, select a file, expand a pane).
