import type { CliRenderer } from '@opentui/core';
import { findTheme } from '@reviewer/core/themes';
import * as React from 'react';
import { saveSettings, TERMINAL_THEME } from '../store/settings';
import type { Appearance, Settings } from '../store/settings';
import { resolveLook, wantedScheme } from '../theme/resolveLook';
import type { Look } from '../theme/resolveLook';
import { watchSystemScheme } from '../theme/systemAppearance';
import { terminalLook } from '../theme/terminalTheme';
import type { Scheme, TerminalLook } from '../theme/terminalTheme';

export type ThemeState = ReturnType<typeof useTheme>;

export interface ThemeStart {
  look: Look;
  settings: Settings;
  system: Scheme | null;
  terminal: TerminalLook | null;
  override?: string;
}

const APPEARANCES: Appearance[] = ['system', 'light', 'dark'];
const PALETTE_TIMEOUT_MS = 400;
const TERMINAL_RECHECK_MS = [500, 1500];

/** Asks the terminal for its colours; `null` when it does not answer. */
export async function readTerminalLook(
  renderer: CliRenderer,
): Promise<TerminalLook | null> {
  try {
    renderer.clearPaletteCache();
    return terminalLook(
      await renderer.getPalette({ timeout: PALETTE_TIMEOUT_MS }),
    );
  } catch {
    return null;
  }
}

/**
 * The look on screen: the settings resolved against the OS appearance and
 * the terminal's colours, re-resolved whenever either changes.
 */
export function useTheme(renderer: CliRenderer, start: ThemeStart) {
  const [settings, setSettings] = React.useState(start.settings);
  const [system, setSystem] = React.useState(start.system);
  const [terminal, setTerminal] = React.useState(start.terminal);
  const [override, setOverride] = React.useState(start.override);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [look, setLook] = React.useState(start.look);

  React.useEffect(() => {
    const refreshTerminal = () =>
      void readTerminalLook(renderer).then((next) => next && setTerminal(next));
    const followUps: Array<ReturnType<typeof setTimeout>> = [];
    const stopWatching = watchSystemScheme((scheme) => {
      setSystem(scheme);
      refreshTerminal();
      // terminals that follow the OS repaint a beat later, often unannounced
      for (const delay of TERMINAL_RECHECK_MS)
        followUps.push(setTimeout(refreshTerminal, delay));
    });
    renderer.on('theme_mode', refreshTerminal);
    return () => {
      stopWatching();
      followUps.forEach(clearTimeout);
      renderer.off('theme_mode', refreshTerminal);
    };
  }, [renderer]);

  React.useEffect(() => {
    let cancelled = false;
    void resolveLook({
      settings,
      system,
      terminal,
      override: preview ?? override,
    }).then((next) => {
      if (cancelled) return;
      renderer.setBackgroundColor(next.palette.frame);
      setLook(next);
    });
    return () => {
      cancelled = true;
    };
  }, [renderer, settings, system, terminal, override, preview]);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setOverride(undefined);
    setPreview(null);
    saveSettings(next);
    return next;
  }

  const scheme = wantedScheme({ settings, system, terminal });

  return {
    look,
    settings,
    /** The scheme the appearance resolves to right now. */
    scheme,
    preview: setPreview,
    /** Keeps `name` for its scheme; `terminal` serves both. */
    choose(name: string): Scheme | 'both' {
      if (name === TERMINAL_THEME) {
        update({ lightTheme: name, darkTheme: name });
        return 'both';
      }
      const themeScheme = findTheme(name)?.colorScheme ?? 'dark';
      update(
        themeScheme === 'dark' ? { darkTheme: name } : { lightTheme: name },
      );
      return themeScheme;
    },
    setAppearance: (appearance: Appearance) => update({ appearance }),
    /** Saves any other preference kept beside the theme. */
    updateSettings: (patch: Partial<Settings>) => void update(patch),
    cycleAppearance() {
      const index = APPEARANCES.indexOf(settings.appearance);
      return update({
        appearance: APPEARANCES[(index + 1) % APPEARANCES.length]!,
      }).appearance;
    },
  };
}
