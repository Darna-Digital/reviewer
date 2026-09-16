/**
 * How each edit mode presents itself.
 *
 * One table rather than two, because the mode is chosen in two places — in
 * Settings and on the open file's own bar — and a label or an icon that said
 * one thing in one of them and another in the other would read as two different
 * settings rather than one.
 */
import {
  IconCursorText,
  IconKeyboard,
  IconMessagePlus,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { EDIT_MODES, type EditMode } from "../interfaces/edit-mode.interfaces";

export interface EditModeOption {
  readonly value: EditMode;
  readonly label: string;
  /** One line on what the keys do, for the Settings row and the menu. */
  readonly detail: string;
  readonly icon: ComponentType<{ className?: string }>;
}

const BY_MODE: Readonly<Record<EditMode, Omit<EditModeOption, "value">>> = {
  comment: {
    label: "Comment",
    detail: "Read only — the gutter leaves comments on a line, as a diff does",
    icon: IconMessagePlus,
  },
  normal: {
    label: "Normal",
    detail: "Type into the file, as in any editor",
    icon: IconCursorText,
  },
  vim: {
    label: "Vim",
    detail:
      "Modal editing: Vim motions and operators, a block caret, and line numbers counted from the caret",
    icon: IconKeyboard,
  },
};

/** The modes in the order they are offered, least to most keyboard. */
export const EDIT_MODE_OPTIONS: ReadonlyArray<EditModeOption> = EDIT_MODES.map(
  (value) => ({ value, ...BY_MODE[value] })
);

export const editModeOption = (mode: EditMode): EditModeOption => ({
  value: mode,
  ...BY_MODE[mode],
});
