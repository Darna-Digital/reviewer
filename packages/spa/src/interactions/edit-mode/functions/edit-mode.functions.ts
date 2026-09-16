/**
 * Reading the edit mode back out of storage.
 *
 * Kept apart from the preference store so the one awkward part — that the mode
 * used to be a `vimMode` boolean — is stated once and can be tested.
 */
import { EDIT_MODES, type EditMode } from "../interfaces/edit-mode.interfaces";

/** What the preference looks like on disk, across the versions that wrote it. */
export interface StoredEditMode {
  readonly editMode?: unknown;
  /** Written by versions before the mode selector existed. */
  readonly vimMode?: unknown;
}

/**
 * The mode a stored profile means. A profile written before the selector
 * existed only says whether Vim mode was on, and someone who had switched it on
 * should not find it switched off by an upgrade.
 */
export const asEditMode = (stored: StoredEditMode): EditMode => {
  if (EDIT_MODES.includes(stored.editMode as EditMode))
    return stored.editMode as EditMode;
  return stored.vimMode === true ? "vim" : "normal";
};
