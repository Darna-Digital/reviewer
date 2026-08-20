import {
  IconAlertTriangle,
  IconLayoutColumns,
  IconLayoutRows,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDiffNarrowed } from "@/interactions/diff/adapters/diff-layout.store";
import { cn } from "@/lib/utils";
import type { DiffStyle } from "@/lib/ui-prefs";

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

interface DiffStyleToggleProps {
  value: DiffStyle;
  onChange: (style: DiffStyle) => void;
}

export function DiffStyleToggle({ value, onChange }: DiffStyleToggleProps) {
  // The pane lays a diff out inline when it is too narrow for two columns. The
  // choice is still horizontal — widening the window brings it back — so the
  // toggle keeps pointing at it and says why it is not getting it, rather than
  // silently moving to the other option and losing what was asked for.
  const narrowed = useDiffNarrowed();
  const active = narrowed && value === "split" ? "unified" : value;
  const activeIndex = OPTIONS.findIndex((option) => option.value === active);

  return (
    <div className="relative flex items-center rounded-lg border p-0.5">
      <div
        aria-hidden
        className="absolute top-0.5 left-0.5 size-6 rounded-[6px] bg-secondary transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {OPTIONS.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={
                  narrowed && option.value === "split"
                    ? `${option.label} diff layout — not enough space`
                    : `${option.label} diff layout`
                }
                aria-pressed={value === option.value}
                onClick={() => onChange(option.value)}
                className={cn(
                  "relative flex size-6 items-center justify-center rounded-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active === option.value
                    ? "text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  // The choice that is being withheld. Dimmed rather than
                  // disabled: it is still what the reader wants, and it comes
                  // back on its own the moment the pane is wide enough.
                  narrowed &&
                    option.value === "split" &&
                    "text-amber-600/70 dark:text-amber-400/70"
                )}
              />
            }
          >
            <option.icon className="size-3.5" />
          </TooltipTrigger>
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
              {/* Only under Horizontal, and only while it is the one that
                  cannot be given: this is the answer to "I picked that, why am
                  I not looking at it". */}
              {narrowed && option.value === "split" && (
                <span className="mt-1 flex items-start gap-1.5 font-normal text-amber-600 dark:text-amber-400">
                  <IconAlertTriangle className="mt-px size-3 shrink-0" />
                  <span className="text-pretty">
                    Not enough space to fit both sides — showing the diff
                    vertically until there is more room. Widen the window, or a
                    side column, to get it back.
                  </span>
                </span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
