/**
 * Styles for the diagnostic marks, injected into the view's shadow root.
 *
 * `@pierre/diffs` renders the code inside a `<diffs-container>` shadow root, so
 * nothing in `styles.css` reaches the tokens — the view's `unsafeCSS` option is
 * the supported way in. Custom properties still inherit across the boundary,
 * which is why the theme colours below resolve normally.
 *
 * Underlines are drawn as a repeating background rather than `text-decoration`:
 * a decoration inherits the token's syntax colour and shifts the baseline on
 * wrapped lines, while a background sits under the glyphs the way an IDE draws
 * it and costs nothing in layout.
 */
export const DIAGNOSTIC_CSS = `
[data-diagnostic] {
  background-repeat: repeat-x;
  background-position: left calc(100% - 1px);
  background-size: 6px 3px;
  padding-bottom: 1px;
}
[data-diagnostic="error"] {
  background-image: radial-gradient(
    circle at 1.5px 2.4px,
    var(--destructive, #ef4444) 1px,
    transparent 1.2px
  );
}
[data-diagnostic="warning"] {
  background-image: radial-gradient(
    circle at 1.5px 2.4px,
    #f59e0b 1px,
    transparent 1.2px
  );
}
[data-diagnostic="information"] {
  background-image: radial-gradient(
    circle at 1.5px 2.4px,
    #0ea5e9 1px,
    transparent 1.2px
  );
}
/* Hints are the weakest signal: a flat, muted underline rather than a wave. */
[data-diagnostic="hint"] {
  background-image: linear-gradient(
    to right,
    color-mix(in oklab, currentColor 45%, transparent) 0 100%
  );
  background-size: 100% 1px;
}

/* Unused code fades and deprecated code is struck through; neither is an error,
   so neither earns a squiggle of its own. */
[data-diagnostic-tag~="unnecessary"] {
  opacity: 0.55;
}
[data-diagnostic-tag~="deprecated"] {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
[data-diagnostic-tag~="unnecessary"][data-diagnostic="hint"] {
  background-image: none;
}

/* The line a jump landed on, flashed so the eye can find it. */
[data-revealed] {
  animation: byconvo-reveal-flash 1.6s ease-out;
}
@keyframes byconvo-reveal-flash {
  0%,
  30% {
    background-color: color-mix(in oklab, var(--primary, #3b82f6) 22%, transparent);
  }
  100% {
    background-color: transparent;
  }
}
`;
