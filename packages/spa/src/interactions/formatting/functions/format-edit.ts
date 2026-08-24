/**
 * The smallest edit that turns one document into another.
 *
 * Prettier reprints from its own AST and has no idea which spans it touched, so
 * the only honest description of what it did is "the file now reads like this".
 * Replacing the whole document with that would work and would be wrong to use:
 * it moves the caret to the top, throws away the selection, and puts the entire
 * file into the undo stack as one opaque step.
 *
 * Trimming the shared prefix and suffix recovers the part that actually moved,
 * which for the usual save — a missing semicolon, a reflowed line — is a few
 * characters, and leaves a caret outside that span exactly where it was.
 */
import { positionAt, type TextEdit } from "@byconvo/core/language";

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

export const minimalEdit = (before: string, after: string): TextEdit | null => {
  if (before === after) return null;

  const shortest = Math.min(before.length, after.length);
  let prefix = 0;
  while (
    prefix < shortest &&
    before.charCodeAt(prefix) === after.charCodeAt(prefix)
  ) {
    prefix++;
  }
  // Never cut between the halves of an astral character: each half alone is not
  // text, and an edit built from one would corrupt the document.
  if (prefix > 0 && isHighSurrogate(before.charCodeAt(prefix - 1))) prefix--;

  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before.charCodeAt(before.length - 1 - suffix) ===
      after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix++;
  }
  if (suffix > 0 && isLowSurrogate(before.charCodeAt(before.length - suffix)))
    suffix--;

  return {
    range: {
      start: positionAt(before, prefix),
      end: positionAt(before, before.length - suffix),
    },
    newText: after.slice(prefix, after.length - suffix),
  };
};
