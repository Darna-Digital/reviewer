import type { Overlay } from '../app/useApp';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';

const POPOVER_WIDTH = 72;

/** More than one declaration: pick where to go. */
export function DefinitionPicker({
  overlay,
}: {
  overlay: Extract<Overlay, { kind: 'definitions' }>;
}) {
  const app = useAppContext();
  const { actions } = app;
  return (
    <Picker
      palette={app.palette}
      screen={app.screen}
      anchor={overlay.at}
      width={POPOVER_WIDTH}
      title={`→ ${overlay.targets.length} declarations of ${overlay.symbol}`}
      placeholder="Filter declarations…"
      options={overlay.targets.map((target, i) => ({
        key: String(i),
        label: `${target.location.path}:${target.location.range.start.line + 1}`,
        hint: target.kind,
        detail: target.preview,
      }))}
      onClose={actions.closeOverlay}
      onPick={(picked) => {
        actions.closeOverlay();
        const target = overlay.targets[Number(picked.key)];
        if (target) actions.openLocation(target.location);
      }}
    />
  );
}

/**
 * The symbols on the cursor's line — the keyboard's way to the symbol
 * menu. ⏎ goes to the definition, ⌃U finds usages, → opens the full menu
 * beside the row.
 */
export function LineSymbolPicker({
  overlay,
  inert = false,
}: {
  overlay: Extract<Overlay, { kind: 'lineSymbols' }>;
  inert?: boolean;
}) {
  const app = useAppContext();
  const { actions, palette } = app;
  const unique = overlay.spots.filter(
    (spot, i) =>
      overlay.spots.findIndex(
        (s) => s.identifier.name === spot.identifier.name,
      ) === i,
  );
  return (
    <Picker
      palette={palette}
      screen={app.screen}
      anchor={overlay.at}
      width={48}
      inert={inert}
      title="Symbol"
      placeholder="Pick a symbol…"
      options={unique.map((spot, i) => ({
        key: String(i),
        label: spot.identifier.name,
        hint: '→ actions',
      }))}
      footer={[
        { text: ' ⏎', fg: palette.muted },
        { text: ' definition  ', fg: palette.faint },
        { text: '⌃U', fg: palette.muted },
        { text: ' usages  ', fg: palette.faint },
        { text: '→', fg: palette.muted },
        { text: ' more', fg: palette.faint },
      ]}
      onKey={(key, picked, beside) => {
        const spot = picked ? unique[Number(picked.key)] : undefined;
        if (!spot) return false;
        if (key === 'right') {
          actions.symbolMenu(spot, beside, overlay);
          return true;
        }
        if (key === 'ctrl+u') {
          actions.closeOverlay();
          actions.findUsages(spot);
          return true;
        }
        return false;
      }}
      onClose={actions.closeOverlay}
      onPick={(picked) => {
        actions.closeOverlay();
        const spot = unique[Number(picked.key)];
        if (spot) void actions.goToDefinition(spot, overlay.at);
      }}
    />
  );
}

/** The open file's outline: every symbol, indented by nesting; picking jumps to it. */
export function OutlinePicker({
  overlay,
}: {
  overlay: Extract<Overlay, { kind: 'outline' }>;
}) {
  const app = useAppContext();
  const { actions, palette } = app;
  return (
    <Picker
      palette={palette}
      screen={app.screen}
      title={`Symbols in ${overlay.path.split('/').at(-1) ?? overlay.path}`}
      placeholder="Go to symbol…"
      options={overlay.symbols.map((symbol, i) => ({
        key: String(i),
        label: `${'  '.repeat(symbol.depth)}${symbol.name}`,
        hint: `${symbol.kind}  ${symbol.selectionRange.start.line + 1}`,
        hintColor: palette.faint,
      }))}
      onClose={actions.closeOverlay}
      onPick={(picked) => {
        actions.closeOverlay();
        const symbol = overlay.symbols[Number(picked.key)];
        if (symbol) actions.goToSymbol(overlay.path, symbol);
      }}
    />
  );
}
