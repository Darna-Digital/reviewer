import { RGBA } from '@opentui/core';
import type { ChromeTokens } from '@reviewer/core/themes';

export interface Palette {
  scheme: 'light' | 'dark';
  /** Header, status bar and sidebar. */
  frame: string;
  /** Where code sits. */
  island: string;
  /** Cards and inputs. */
  control: string;
  /** Modals. */
  popover: string;
  text: string;
  muted: string;
  faint: string;
  rule: string;
  hairline: string;
  accent: string;
  /** Text on an accent fill. */
  accentInk: string;
  /** Selected row of the focused list. */
  selection: string;
  /** Selected row of an unfocused list, and hover. */
  selectionIdle: string;
  added: string;
  modified: string;
  deleted: string;
  renamed: string;
  warning: string;
  diff: {
    addBg: string;
    addEmphasis: string;
    addGutter: string;
    delBg: string;
    delEmphasis: string;
    delGutter: string;
    emptyBg: string;
    hunkBg: string;
    hunkText: string;
    lineNumber: string;
    fileBg: string;
  };
  /** History graph lanes, cycled by column. */
  lanes: string[];
  /** The Mac sidebar's git-status letter colours. */
  gitStatus: Record<
    'added' | 'untracked' | 'modified' | 'deleted' | 'renamed',
    string
  >;
  /** Running / failed / finished process dots. */
  process: { running: string; failed: string; idle: string };
}

/** Blends `top` over `bottom`; terminals have no alpha, so tints are mixed down. */
export function mix(bottom: string, top: string, amount = 1): string {
  const a = parseHex(bottom);
  const b = parseHex(top);
  const t = amount * b.a;
  return toHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

/** The app's chrome tokens, plus the tints a terminal diff needs. */
export function createPalette(chrome: ChromeTokens): Palette {
  const dark = chrome.colorScheme === 'dark';
  const { island, frame } = chrome;
  const tint = dark ? 1 : 0.8;
  const warning = dark ? '#e5c07b' : '#b58407';
  const renamed = dark ? '#c792ea' : '#8250df';

  return {
    scheme: chrome.colorScheme,
    frame,
    island,
    control: chrome.control,
    popover: chrome.popover,
    text: chrome.text,
    muted: chrome.textSecondary,
    faint: chrome.textTertiary,
    rule: mix(frame, chrome.separator),
    hairline: mix(island, chrome.separator),
    accent: chrome.accent,
    accentInk: dark ? '#0b0b0d' : '#ffffff',
    selection: mix(frame, chrome.selection),
    selectionIdle: mix(frame, chrome.hover),
    added: chrome.added,
    modified: chrome.modified,
    deleted: chrome.deleted,
    renamed,
    warning,
    diff: {
      addBg: mix(island, chrome.added, 0.1 * tint),
      addEmphasis: mix(island, chrome.added, 0.3 * tint),
      addGutter: mix(island, chrome.added, 0.18 * tint),
      delBg: mix(island, chrome.deleted, 0.1 * tint),
      delEmphasis: mix(island, chrome.deleted, 0.3 * tint),
      delGutter: mix(island, chrome.deleted, 0.18 * tint),
      emptyBg: mix(island, chrome.text, 0.025),
      hunkBg: mix(island, chrome.accent, 0.07),
      hunkText: mix(island, chrome.accent, 0.75),
      lineNumber: chrome.textTertiary,
      fileBg: mix(island, chrome.text, 0.05),
    },
    gitStatus: dark
      ? {
          added: '#00cab1',
          untracked: '#00cab1',
          modified: '#08c0ef',
          deleted: '#ff6762',
          renamed: '#ffd452',
        }
      : {
          added: '#16a994',
          untracked: '#16a994',
          modified: '#1ca1c7',
          deleted: '#ff2e3f',
          renamed: '#d5a910',
        },
    process: {
      running: chrome.added,
      failed: chrome.deleted,
      idle: chrome.textTertiary,
    },
    // the Mac history graph's lane colours
    lanes: [
      '#5b9bf8',
      '#48b884',
      '#e0533d',
      '#d8a13a',
      '#a86fd4',
      '#3bb0c9',
      '#e06fa8',
      '#8c9440',
    ],
  };
}

const rgbaCache = new Map<string, RGBA>();

export function rgba(color: string): RGBA {
  let value = rgbaCache.get(color);
  if (!value) {
    value = RGBA.fromHex(color);
    rgbaCache.set(color, value);
  }
  return value;
}

function parseHex(hex: string) {
  const raw = hex.replace('#', '');
  const full = raw.length <= 4 ? [...raw].map((c) => c + c).join('') : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length >= 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
  };
}

function toHex(...channels: number[]): string {
  return `#${channels
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
