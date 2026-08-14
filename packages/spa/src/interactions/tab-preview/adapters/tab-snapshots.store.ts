/**
 * The pictures themselves, held for as long as the window is open.
 *
 * They outlive the launchpad on purpose: closing it and opening it again is the
 * commonest thing you do with it, and a card that has already been drawn once
 * should be there the instant it is asked for. Only tabs that are still open
 * are kept — a closed tab's picture is of a place you can no longer go.
 */
import { useSyncExternalStore } from "react";
import type { TabSnapshot } from "../functions/tab-snapshot.functions";

let snapshots: ReadonlyMap<string, TabSnapshot> = new Map();
const listeners = new Set<() => void>();

const publish = (next: ReadonlyMap<string, TabSnapshot>) => {
  snapshots = next;
  for (const listener of listeners) listener();
};

export function putSnapshot(href: string, html: string, at: number): void {
  const held = snapshots.get(href);
  if (held?.html === html) return;
  publish(new Map(snapshots).set(href, { html, at }));
}

/** Forget the pictures of places that are no longer open. */
export function keepSnapshotsFor(hrefs: ReadonlyArray<string>): void {
  const open = new Set(hrefs);
  if ([...snapshots.keys()].every((href) => open.has(href))) return;
  publish(new Map([...snapshots].filter(([href]) => open.has(href))));
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

/** What has been drawn so far — how the mill knows what to take first. */
export const snapshotAt = (href: string): TabSnapshot | undefined =>
  snapshots.get(href);
