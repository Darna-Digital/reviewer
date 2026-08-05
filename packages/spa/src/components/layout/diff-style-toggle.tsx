import { IconLayoutColumns, IconLayoutRows } from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DiffStyle } from "@/lib/ui-prefs";

type PreviewLineKind = "context" | "removed" | "added";

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
        kind === "added" && "bg-green-500/10"
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
      <span
        className={cn(
          "h-1 rounded-full",
          width,
          kind === "context" && "bg-muted-foreground/25",
          kind === "removed" && "bg-red-500/50",
          kind === "added" && "bg-green-500/50"
        )}
      />
    </div>
  );
}

function HorizontalPreview() {
  return (
    <div className="flex overflow-hidden rounded-md border bg-background">
      <div className="flex-1 space-y-px border-r p-1">
        <PreviewLine kind="context" width="w-3/4" />
        <PreviewLine kind="removed" width="w-full" />
        <PreviewLine kind="context" width="w-1/2" />
      </div>
      <div className="flex-1 space-y-px p-1">
        <PreviewLine kind="context" width="w-3/4" />
        <PreviewLine kind="added" width="w-full" />
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
  },
  {
    value: "unified",
    label: "Vertical",
    detail: "Changes stacked",
    icon: IconLayoutRows,
    preview: VerticalPreview,
  },
] as const;

interface DiffStyleToggleProps {
  value: DiffStyle;
  onChange: (style: DiffStyle) => void;
}

export function DiffStyleToggle({ value, onChange }: DiffStyleToggleProps) {
  const activeIndex = OPTIONS.findIndex((option) => option.value === value);

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
                aria-label={`${option.label} diff layout`}
                aria-pressed={value === option.value}
                onClick={() => onChange(option.value)}
                className={cn(
                  "relative flex size-6 items-center justify-center rounded-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  value === option.value
                    ? "text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              />
            }
          >
            <option.icon className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="w-44 flex-col items-stretch gap-1.5 rounded-xl p-2"
          >
            <option.preview />
            <div className="flex flex-col gap-0.5 px-0.5">
              <span>{option.label}</span>
              <span className="font-normal text-muted-foreground">
                {option.detail}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
