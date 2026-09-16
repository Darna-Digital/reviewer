/**
 * Choosing the edit mode from the open file's own bar.
 *
 * The setting lives in Settings as well, but the mode is something you change
 * *about the file in front of you* — you drop into commenting because of the
 * code you are reading right now, not because of how you like the app set up.
 * So it sits where its consequences are, beside the Vim mode line, and says
 * which mode is on whether or not the menu is open.
 */
import { IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { EDIT_MODE_OPTIONS, editModeOption } from "./edit-mode-options";
import type { EditMode } from "../interfaces/edit-mode.interfaces";

export function EditModePicker() {
  const { editMode } = useUiPrefs();
  const current = editModeOption(editMode);
  const Icon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost-muted"
            size="xs"
            aria-label={`Edit mode: ${current.label}`}
          >
            <Icon className="size-3.5" />
            {current.label}
            <IconChevronDown className="size-3" data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={editMode}
          onValueChange={(value) => setUiPrefs({ editMode: value as EditMode })}
        >
          {EDIT_MODE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
