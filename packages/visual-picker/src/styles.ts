export const styles = `
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
      system-ui, sans-serif;
    --accent: oklch(0.69 0.16 265.2);
    --accent-soft: oklch(0.69 0.16 265.2 / 0.12);
    --accent-mid: oklch(0.69 0.16 265.2 / 0.2);
    --accent-ring: oklch(0.69 0.16 265.2 / 0.25);
    --accent-glow: oklch(0.69 0.16 265.2 / 0.4);
    --accent-fill: oklch(0.69 0.16 265.2 / 0.22);
    --surface: rgba(18, 18, 23, 0.92);
    --border: rgba(255, 255, 255, 0.12);
    --text: #f4f4f6;
    --muted: rgba(244, 244, 246, 0.55);
  }

  * { box-sizing: border-box; }

  .highlight {
    position: absolute;
    border: 1.5px solid var(--accent);
    border-radius: 3px;
    background: var(--accent-soft);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25) inset;
    transition: transform 90ms cubic-bezier(0.2, 0.8, 0.2, 1),
      width 90ms cubic-bezier(0.2, 0.8, 0.2, 1),
      height 90ms cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
  }
  .highlight[data-locked="true"] {
    background: var(--accent-mid);
    border-width: 2px;
  }

  .badge {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: min(520px, calc(100vw - 24px));
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    color: var(--text);
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
  }
  .badge .node { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .badge .tag { color: #ff8fd4; }
  .badge .id { color: #ffd479; }
  .badge .cls { color: #8ee6ff; }
  .badge .quoted { color: var(--text); opacity: 0.75; }
  .badge .sep { width: 1px; height: 12px; background: var(--border); }
  .badge .dim { color: var(--muted); font-variant-numeric: tabular-nums; }
  .badge .src {
    color: #9dffb0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .composer {
    position: absolute;
    width: 320px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    color: var(--text);
    pointer-events: auto;
  }
  .composer .target {
    display: block;
    margin-bottom: 8px;
    overflow: hidden;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .composer textarea {
    display: block;
    width: 100%;
    min-height: 76px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    color: var(--text);
    font-family: inherit;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
  }
  .composer textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-ring);
  }
  .composer textarea::placeholder { color: var(--muted); }
  .composer .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }
  .composer .hint { color: var(--muted); font-size: 11px; }

  button {
    padding: 5px 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: var(--accent);
    color: white;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  button:hover { filter: brightness(1.12); }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  button:disabled { opacity: 0.45; cursor: not-allowed; filter: none; }
  button.ghost {
    background: transparent;
    border-color: var(--border);
    color: var(--muted);
  }
  button.ghost:hover { color: var(--text); filter: none; }

  .pin {
    position: absolute;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1.5px solid rgba(255, 255, 255, 0.9);
    border-radius: 50% 50% 50% 2px;
    background: var(--accent);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
    color: white;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto;
  }
  .pin:hover { transform: scale(1.12); }
  .pin[data-orphan="true"] { background: #8a8a94; }

  .card {
    position: absolute;
    width: 280px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
    color: var(--text);
    font-size: 13px;
    line-height: 1.5;
    pointer-events: auto;
  }
  .card .meta {
    margin-bottom: 6px;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
  }
  .card .body { white-space: pre-wrap; word-break: break-word; }
  .card .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 10px;
  }

  .launcher {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    transition: opacity 140ms ease;
    opacity: 0.55;
  }
  .launcher:hover,
  .launcher[data-active="true"] { opacity: 1; }
  .launcher[data-active="true"] {
    border-color: var(--accent);
    box-shadow: 0 8px 28px var(--accent-glow);
  }
  .launcher[data-placement="bottom-left"] { left: 16px; bottom: 16px; }
  .launcher[data-placement="bottom-right"] { right: 16px; bottom: 16px; }
  .launcher[data-placement="top-left"] { left: 16px; top: 16px; }
  .launcher[data-placement="top-right"] { right: 16px; top: 16px; }

  .launcher .toggle,
  .launcher .gear {
    display: flex;
    align-items: center;
    border: none;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
  }
  .launcher .toggle {
    gap: 7px;
    padding: 3px 8px;
    border-radius: 999px;
  }
  .launcher .toggle:hover { background: rgba(255, 255, 255, 0.08); filter: none; }
  .launcher .gear {
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
    color: var(--muted);
  }
  .launcher .gear:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
    filter: none;
  }
  .launcher .gear svg { width: 13px; height: 13px; }

  .launcher .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
  }
  .launcher[data-active="true"] .dot { animation: pulse 1.4s ease-in-out infinite; }
  .launcher .count {
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    font-variant-numeric: tabular-nums;
  }
  .launcher kbd {
    color: var(--muted);
    font-family: inherit;
    font-size: 11px;
  }

  .settings {
    position: absolute;
    min-width: 150px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  }
  [data-placement$="-left"] .settings { left: 0; }
  [data-placement$="-right"] .settings { right: 0; }
  [data-placement^="bottom-"] .settings { bottom: calc(100% + 8px); }
  [data-placement^="top-"] .settings { top: calc(100% + 8px); }

  .settings-heading {
    margin: 3px 8px 5px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .settings-option {
    display: block;
    width: 100%;
    padding: 5px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text);
    font-size: 12px;
    font-weight: 400;
    text-align: left;
  }
  .settings-option:hover { background: rgba(255, 255, 255, 0.08); filter: none; }
  .settings-option[data-active="true"] {
    background: var(--accent-fill);
    color: var(--text);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .toast {
    position: absolute;
    left: 50%;
    bottom: 24px;
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    backdrop-filter: blur(16px);
    color: var(--text);
    font-size: 12px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  [hidden] { display: none !important; }
`
