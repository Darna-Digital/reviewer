/**
 * The images a composer is holding but has not sent, keyed the way composer
 * drafts are: a chat id, or `NEW_CHAT_DRAFT` for the session that does not
 * exist yet.
 *
 * Out here rather than in the composer's own state for the same reason the
 * draft text is (lib/drafts.ts): the composer unmounts on every navigation, so
 * a screenshot dropped into a session you have not finished writing should
 * still be attached when you come back to finish the sentence.
 *
 * In memory rather than in localStorage, unlike the text. An attachment carries
 * the full-resolution image as base64 — up to `MAX_IMAGE_BYTES` of it, each —
 * which no web-storage quota would hold, and persisting only the thumbnail
 * would quietly hand the agent a downscaled picture instead of the one that was
 * attached. So attachments outlive navigation, not a reload. Entries clear when
 * the message is sent.
 */
import { useSyncExternalStore } from "react";
import type { ComposerAttachment } from "../components/attachments";

/** One shared empty array, so an untouched composer keeps a stable snapshot. */
const NONE: ReadonlyArray<ComposerAttachment> = [];

let pending: Readonly<Record<string, ReadonlyArray<ComposerAttachment>>> = {};
const listeners = new Set<() => void>();

const write = (key: string, next: ReadonlyArray<ComposerAttachment>): void => {
  if (next.length === 0) {
    if (!(key in pending)) return;
    const { [key]: _removed, ...rest } = pending;
    pending = rest;
  } else {
    pending = { ...pending, [key]: next };
  }
  for (const listener of listeners) listener();
};

/** Everything `key`'s composer is currently holding. */
export const composerAttachments = (
  key: string
): ReadonlyArray<ComposerAttachment> => pending[key] ?? NONE;

/** Attach one more image, after the ones already picked. */
export const addComposerAttachment = (
  key: string,
  attachment: ComposerAttachment
): void => write(key, [...composerAttachments(key), attachment]);

export const removeComposerAttachment = (key: string, id: string): void => {
  const current = composerAttachments(key);
  const next = current.filter((attachment) => attachment.id !== id);
  if (next.length === current.length) return;
  write(key, next);
};

/** Drop the lot — what a sent message does with what it took with it. */
export const clearComposerAttachments = (key: string): void => write(key, NONE);

export const useComposerAttachments = (
  key: string
): ReadonlyArray<ComposerAttachment> =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => composerAttachments(key),
    () => NONE
  );

/** Test seam: forget every composer's pending images. */
export const resetComposerAttachments = (): void => {
  pending = {};
  for (const listener of listeners) listener();
};
