/**
 * The formatting setting: what this project formats with, and whether saving
 * runs it.
 *
 * The switch is the whole feature from the user's side, so the row's detail
 * line has to carry the rest — which formatter was found, which version, and
 * which file configures it. A project with no formatter says so and offers a
 * switch that would do nothing, which is why it is disabled rather than hidden:
 * "reviewer cannot format this project" is the answer someone came here for.
 */
import { IconWand } from "@tabler/icons-react";
import { Switch } from "@/components/ui/switch";
import { SettingRow } from "@/interactions/settings/components/setting-row";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { useFormatter } from "../adapters/formatting.hook.adapter";

export function FormatOnSaveSetting() {
  const prefs = useUiPrefs();
  const formatter = useFormatter();
  const available = formatter.data?.available ?? false;
  const detail = formatter.isPending
    ? "Looking for a formatter in this project…"
    : (formatter.data?.detail ??
      "Could not check this project for a formatter");
  const on = prefs.formatOnSave && available;

  return (
    <SettingRow title="Format on save" detail={detail}>
      <label className="flex items-center gap-2">
        <IconWand
          className={cn(
            "size-4 text-muted-foreground",
            on && "text-foreground"
          )}
        />
        <Switch
          checked={on}
          disabled={!available}
          onChange={(event) =>
            setUiPrefs({ formatOnSave: event.currentTarget.checked })
          }
          aria-label="Format on save"
        />
      </label>
    </SettingRow>
  );
}
