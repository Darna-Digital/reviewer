/**
 * The pictures themselves, held for as long as the window is open.
 *
 * They outlive the launchpad on purpose: closing it and opening it again is the
 * commonest thing you do with it, and a card that has already been drawn once
 * should be there the instant it is asked for.
 *
 * The rules the pictures are drawn with are held once beside them rather than
 * in each: every page in the app wears the same stylesheet, and a card adopts
 * that one sheet instead of carrying a copy of it.
 */
import { useSyncExternalStore } from "react";
import type { PreviewCapture } from "../functions/preview-capture.functions";
import type { TabSnapshot } from "../functions/tab-snapshot.functions";

let snapshots: ReadonlyMap<string, TabSnapshot> = new Map();
let styles = "";
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function putSnapshot(
  href: string,
  capture: PreviewCapture,
  at: number
): void {
  const held = snapshots.get(href);
  if (held?.html === capture.html) return;
  snapshots = new Map(snapshots).set(href, { ...capture, at });
  emit();
}

/** The one stylesheet every card draws against, as the mill last read it. */
export function putPreviewStyles(css: string): void {
  if (css === styles) return;
  styles = css;
  emit();
}

/**
 * Forget every picture. The theme is the one change that makes all of them
 * wrong at once — they were drawn in a window wearing the old one — and a grid
 * of light cards in a dark window reads as broken in a way an empty one does
 * not.
 */
export function forgetSnapshots(): void {
  if (snapshots.size === 0) return;
  snapshots = new Map();
  emit();
}

/** Forget the pictures of places the launchpad no longer lists. */
export function keepSnapshotsFor(hrefs: ReadonlyArray<string>): void {
  const shown = new Set(hrefs);
  if ([...snapshots.keys()].every((href) => shown.has(href))) return;
  snapshots = new Map([...snapshots].filter(([href]) => shown.has(href)));
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTabSnapshot = (href: string): TabSnapshot | undefined =>
  useSyncExternalStore(
    subscribe,
    () => snapshots.get(href),
    () => undefined
  );

export const usePreviewStyles = (): string =>
  useSyncExternalStore(
    subscribe,
    () => styles,
    () => ""
  );

/** What has been drawn so far — how the mill knows what to take first. */
export const snapshotAt = (href: string): TabSnapshot | undefined =>
  snapshots.get(href);
