import {
  IconDeviceDesktop,
  IconDroplet,
  IconGitFork,
  IconLayoutColumns,
  IconLayoutRows,
  IconMoon,
  IconRoute,
  IconSun,
  IconKeyboard,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { FormatOnSaveSetting } from "@/interactions/formatting/components/format-on-save-setting";
import { SettingRow } from "@/interactions/settings/components/setting-row";
import { isDesktop } from "@/lib/desktop";
import {
  setUiPrefs,
  useUiPrefs,
  type DiffStyle,
  type ThemePref,
} from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

type SettingsIcon = ComponentType<{ className?: string }>;

const THEME_OPTIONS: {
  value: ThemePref;
  label: string;
  icon: SettingsIcon;
}[] = [
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
  { value: "system", label: "System", icon: IconDeviceDesktop },
];

const DIFF_OPTIONS: {
  value: DiffStyle;
  label: string;
  icon: SettingsIcon;
}[] = [
  { value: "split", label: "Horizontal", icon: IconLayoutColumns },
  { value: "unified", label: "Vertical", icon: IconLayoutRows },
];

function SegmentedOption<T extends string>({
  value,
  label,
  icon: Icon,
  selected,
  onSelect,
}: {
  value: T;
  label: string;
  icon: SettingsIcon;
  selected: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={selected}
      onClick={() => onSelect(value)}
      className="min-w-24 justify-start"
    >
      <Icon className="size-4" />
      {label}
    </Button>
  );
}

export function SettingsPage() {
  const prefs = useUiPrefs();

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-9 shrink-0 items-center border-b px-4">
          <h1 className="text-sm font-medium">Settings</h1>
        </header>
        <main className="min-h-0 flex-1">
          <ScrollArea className="h-full" viewportClassName="scroll-fade">
            <div className="mx-auto w-full max-w-3xl py-4">
              <section className="border-y">
                <SettingRow
                  title="Theme"
                  detail={`Resolved: ${prefs.resolvedTheme}`}
                >
                  <div className="flex flex-wrap gap-0.5 rounded-md border p-0.5">
                    {THEME_OPTIONS.map((option) => (
                      <SegmentedOption
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        icon={option.icon}
                        selected={prefs.theme === option.value}
                        onSelect={(theme) => setUiPrefs({ theme })}
                      />
                    ))}
                  </div>
                </SettingRow>
                <SettingRow title="Diff layout">
                  <div className="flex flex-wrap gap-0.5 rounded-md border p-0.5">
                    {DIFF_OPTIONS.map((option) => (
                      <SegmentedOption
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        icon={option.icon}
                        selected={prefs.diffStyle === option.value}
                        onSelect={(diffStyle) => setUiPrefs({ diffStyle })}
                      />
                    ))}
                  </div>
                </SettingRow>
                <SettingRow title="Diff connectors">
                  <label className="flex items-center gap-2">
                    <IconRoute
                      className={cn(
                        "size-4 text-muted-foreground",
                        prefs.connectors && "text-foreground"
                      )}
                    />
                    <Switch
                      checked={prefs.connectors}
                      onChange={(event) =>
                        setUiPrefs({ connectors: event.currentTarget.checked })
                      }
                      aria-label="Diff connectors"
                    />
                  </label>
                </SettingRow>
                {/* The desktop behind the window is the only thing there is to
                    show through, so a browser tab has nothing to offer here. */}
                {isDesktop && (
                  <SettingRow
                    title="Translucency"
                    detail="Let the desktop show through the window frame"
                  >
                    <label className="flex items-center gap-2">
                      <IconDroplet
                        className={cn(
                          "size-4 text-muted-foreground",
                          prefs.translucency && "text-foreground"
                        )}
                      />
                      <Switch
                        checked={prefs.translucency}
                        onChange={(event) =>
                          setUiPrefs({
                            translucency: event.currentTarget.checked,
                          })
                        }
                        aria-label="Translucency"
                      />
                    </label>
                  </SettingRow>
                )}
                <SettingRow
                  title="Vim mode"
                  detail="Modal editing in the code view: Vim motions and operators, a block caret, and line numbers counted from the caret"
                >
                  <label className="flex items-center gap-2">
                    <IconKeyboard
                      className={cn(
                        "size-4 text-muted-foreground",
                        prefs.vimMode && "text-foreground"
                      )}
                    />
                    <Switch
                      checked={prefs.vimMode}
                      onChange={(event) =>
                        setUiPrefs({ vimMode: event.currentTarget.checked })
                      }
                      aria-label="Vim mode"
                    />
                  </label>
                </SettingRow>
                <FormatOnSaveSetting />
                <SettingRow title="Git dock">
                  <label className="flex items-center gap-2">
                    <IconGitFork
                      className={cn(
                        "size-4 text-muted-foreground",
                        prefs.bottomVisible && "text-foreground"
                      )}
                    />
                    <Switch
                      checked={prefs.bottomVisible}
                      onChange={(event) =>
                        setUiPrefs({
                          bottomVisible: event.currentTarget.checked,
                        })
                      }
                      aria-label="Git dock"
                    />
                  </label>
                </SettingRow>
              </section>
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
