/**
 * The picker for one scheme's theme: every theme in the catalog written for
 * that scheme, grouped by where it comes from — the app's own pair first,
 * then Pierre's, then Shiki's — with a swatch of each theme's sheet and
 * accent beside its name, so the list can be read as colour before it is
 * read as words. The swatches are the catalog's answer once a theme has
 * been loaded; a theme not yet seen shows a blank swatch until it is.
 */
import {
  deriveChromeTokens,
  describeThemes,
  loadTheme,
  type ChromeTokens,
  type ColorScheme,
  type ThemeDescriptor,
} from "@reviewer/core/themes";
import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE: ReadonlyArray<ThemeDescriptor> = [];

const COLLECTION_LABELS: Record<string, string> = {
  reviewer: "Reviewer",
  pierre: "Pierre",
  shiki: "Shiki",
};

export function ThemeSelect({
  scheme,
  value,
  onChange,
}: {
  scheme: ColorScheme;
  value: string;
  onChange: (name: string) => void;
}) {
  const groups = useMemo(() => groupedThemes(scheme), [scheme]);
  const listed = useMemo(
    () => groups.flatMap((group) => group.themes),
    [groups]
  );
  const [open, setOpen] = useState(false);
  // Loaded only once the list is opened: seventy themes are seventy fetches,
  // and a settings page that is only glanced at should cost none of them.
  const swatches = useSwatches(open ? listed : NONE);
  const selected = listed.find((theme) => theme.name === value);
  return (
    <Select
      value={value}
      open={open}
      onOpenChange={setOpen}
      onValueChange={(name) => name && onChange(name)}
    >
      <SelectTrigger
        className="w-52"
        aria-label={`${scheme === "dark" ? "Dark" : "Light"} theme`}
      >
        <SelectValue>{selected?.displayName ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {groups.map((group) => (
          <SelectGroup key={group.collection}>
            <SelectGroupLabel>{group.label}</SelectGroupLabel>
            {group.themes.map((theme) => (
              <SelectItem key={theme.name} value={theme.name}>
                <Swatch chrome={swatches.get(theme.name)} />
                {theme.displayName}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function groupedThemes(scheme: ColorScheme) {
  const groups = new Map<string, ThemeDescriptor[]>();
  for (const theme of describeThemes()) {
    if (theme.colorScheme !== scheme) continue;
    const members = groups.get(theme.collection) ?? [];
    members.push(theme);
    groups.set(theme.collection, members);
  }
  return [...groups].map(([collection, themes]) => ({
    collection,
    label: COLLECTION_LABELS[collection] ?? collection,
    themes,
  }));
}

/** The chrome of each listed theme, filled in as the themes load. */
function useSwatches(themes: ReadonlyArray<ThemeDescriptor>) {
  const [swatches, setSwatches] = useState(
    () => new Map<string, ChromeTokens>()
  );
  useEffect(() => {
    let cancelled = false;
    for (const { name } of themes) {
      if (swatches.has(name)) continue;
      void loadTheme(name)?.then((theme) => {
        if (cancelled) return;
        setSwatches((known) =>
          known.has(name)
            ? known
            : new Map(known).set(name, deriveChromeTokens(theme))
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [themes, swatches]);
  return swatches;
}

/** The theme's sheet, with its accent set in it. */
function Swatch({ chrome }: { chrome: ChromeTokens | undefined }) {
  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-border"
      style={chrome && { backgroundColor: chrome.island }}
    >
      {chrome && (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: chrome.accent }}
        />
      )}
    </span>
  );
}
