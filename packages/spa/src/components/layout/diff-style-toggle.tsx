import { IconLayoutColumns, IconLayoutRows } from "@tabler/icons-react";
import { useParams, useSearch } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDiffNarrowed } from "@/interactions/diff/adapters/diff-layout.store";
import type { ShellRoute } from "@/lib/shell-route";
import { type DiffStyle, setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

type PreviewLineKind = "context" | "removed" | "added" | "filler";

function PreviewLine({
  kind,
  width,
}: {
  kind: PreviewLineKind;
  width: string;
}) {
  return (
    <div
      className={cn(
        "flex h-3 items-center gap-1 rounded-[3px] px-1",
        kind === "removed" && "bg-red-500/10",
        kind === "added" && "bg-green-500/10",
        kind === "filler" && "bg-muted-foreground/5"
      )}
    >
      <span
        className={cn(
          "w-1.5 text-center font-mono text-[9px] leading-none",
          kind === "removed" && "text-red-600 dark:text-red-400",
          kind === "added" && "text-green-600 dark:text-green-400"
        )}
      >
        {kind === "removed" ? "−" : kind === "added" ? "+" : ""}
      </span>
      {kind !== "filler" && (
        <span
          className={cn(
            "h-1 rounded-full",
            width,
            kind === "context" && "bg-muted-foreground/25",
            kind === "removed" && "bg-red-500/50",
            kind === "added" && "bg-green-500/50"
          )}
        />
      )}
    </div>
  );
}

function HorizontalPreview() {
  return (
    <div className="flex overflow-hidden rounded-md border bg-background">
      <div className="flex-1 space-y-px border-r p-1">
        <PreviewLine kind="context" width="w-3/4" />
        <PreviewLine kind="removed" width="w-full" />
        <PreviewLine kind="filler" width="w-5/6" />
        <PreviewLine kind="context" width="w-1/2" />
      </div>
      <div className="flex-1 space-y-px p-1">
        <PreviewLine kind="context" width="w-3/4" />
        <PreviewLine kind="filler" width="w-full" />
        <PreviewLine kind="added" width="w-5/6" />
        <PreviewLine kind="context" width="w-1/2" />
      </div>
    </div>
  );
}

function VerticalPreview() {
  return (
    <div className="space-y-px overflow-hidden rounded-md border bg-background p-1">
      <PreviewLine kind="context" width="w-3/4" />
      <PreviewLine kind="removed" width="w-full" />
      <PreviewLine kind="added" width="w-5/6" />
      <PreviewLine kind="context" width="w-1/2" />
    </div>
  );
}

const OPTIONS = [
  {
    value: "split",
    label: "Horizontal",
    detail: "Old and new side by side",
    icon: IconLayoutColumns,
    preview: HorizontalPreview,
    // Two columns of lines need more room than the single stacked column.
    width: "w-48",
  },
  {
    value: "unified",
    label: "Vertical",
    detail: "Changes stacked",
    icon: IconLayoutRows,
    preview: VerticalPreview,
    width: "w-44",
  },
] as const;

const NO_ROOM_LABEL = "Horizontal mode needs more screen space";

interface DiffStyleToggleProps {
  value: DiffStyle;
  onChange: (style: DiffStyle) => void;
}

export function DiffStyleToggle({ value, onChange }: DiffStyleToggleProps) {
  // The pane cannot lay two columns out below a certain width, so horizontal is
  // off the table until there is room: the option goes disabled and the diff
  // falls to vertical, and both come back on their own once the pane grows.
  const narrowed = useDiffNarrowed();
  const active = narrowed && value === "split" ? "unified" : value;
  const activeIndex = OPTIONS.findIndex((option) => option.value === active);

  return (
    <div className="relative flex items-center rounded-lg border p-0.5 island:rounded-full">
      <div
        aria-hidden
        className="absolute top-0.5 left-0.5 size-6 rounded-[6px] bg-secondary transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none island:rounded-full"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {OPTIONS.map((option) => {
        const outOfRoom = narrowed && option.value === "split";
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={
                    outOfRoom ? NO_ROOM_LABEL : `${option.label} diff layout`
                  }
                  aria-pressed={value === option.value}
                  // Kept clickable to the pointer so the tooltip can explain
                  // itself; a natively disabled button swallows the hover.
                  aria-disabled={outOfRoom || undefined}
                  onClick={() => {
                    if (!outOfRoom) {
                      onChange(option.value);
                    }
                  }}
                  className={cn(
                    "relative flex size-6 items-center justify-center rounded-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 island:rounded-full",
                    active === option.value
                      ? "text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    outOfRoom &&
                      "cursor-default text-muted-foreground/40 hover:text-muted-foreground/40"
                  )}
                />
              }
            >
              <option.icon className="size-3.5" />
            </TooltipTrigger>
            {outOfRoom ? (
              <TooltipContent side="bottom">{NO_ROOM_LABEL}</TooltipContent>
            ) : (
              <TooltipContent
                side="bottom"
                className={cn(
                  "flex-col items-stretch gap-1.5 rounded-xl p-2",
                  option.width
                )}
              >
                <option.preview />
                <div className="flex flex-col gap-0.5 px-0.5">
                  <span>{option.label}</span>
                  <span className="font-normal text-muted-foreground">
                    {option.detail}
                  </span>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Whether a diff is on screen, which is where the toggle belongs: a code page,
 * with no file open over it, pointed at something to diff — your own changes
 * or a pull request, a commit, or a range.
 */
export function useShowsDiffStyleToggle(route: ShellRoute): boolean {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  return (
    route.kind === "code" &&
    search.file === undefined &&
    (route.mode === "review" ||
      (route.mode === "browse" &&
        (params.sha !== undefined ||
          (search.base !== undefined && search.head !== undefined))))
  );
}

/**
 * The toggle as a chrome row wears it: up while a diff is on screen, and
 * wired to the preference the diff pane reads. The header band has it at its
 * end in the browser tab, and the macOS shell's island bar has it in the same
 * place — see `IslandBar`.
 */
export function HeaderDiffStyleToggle({ route }: { route: ShellRoute }) {
  const shown = useShowsDiffStyleToggle(route);
  const prefs = useUiPrefs();
  if (!shown) return null;
  return (
    <DiffStyleToggle
      value={prefs.diffStyle}
      onChange={(diffStyle) => setUiPrefs({ diffStyle })}
    />
  );
}
