/**
 * The problems bar — the file's diagnostics, gathered into one expandable
 * strip along the bottom of the editor.
 *
 * They used to render as annotation rows under the lines they were about,
 * which put them in the middle of the text being edited: every diagnostic
 * arriving or clearing while typing pushed the code up or down under the
 * caret. Down here the code never moves — the squiggles still mark the spot,
 * and the bar carries the reading matter. Collapsed it is one row of counts;
 * expanded it is the list, worst first, and picking a problem jumps the
 * editor to its line.
 */
import {
  IconChevronDown,
  IconChevronUp,
  IconClipboardCopy,
  IconClipboardList,
  IconClipboardText,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { Diagnostic } from "@reviewer/core/language";
import { SEVERITY_STYLE } from "./diagnostics-annotation";
import { pointerAnchor, type VirtualAnchor } from "../functions/anchors";
import { countDiagnostics } from "../functions/language.functions";
import {
  orderProblems,
  problemOrigin,
  problemPosition,
  problemsLabel,
  problemText,
  problemsText,
} from "../functions/problems.functions";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

interface ProblemsBarProps {
  diagnostics: ReadonlyArray<Diagnostic>;
  expanded: boolean;
  onToggle: () => void;
  /** Jump the editor to the problem's line. */
  onSelect: (diagnostic: Diagnostic) => void;
  /** Prefixes copied problems, so a paste still says which file they are in. */
  path?: string;
  /** Positioning is the host's: the code view floats it over the code. */
  className?: string;
}

/** A right-click's target: one problem, or the strip as a whole. */
interface OpenMenu {
  anchor: VirtualAnchor;
  problem: Diagnostic | null;
}

export function ProblemsBar({
  diagnostics,
  expanded,
  onToggle,
  onSelect,
  path,
  className,
}: ProblemsBarProps) {
  const problems = useMemo(() => orderProblems(diagnostics), [diagnostics]);
  const counts = useMemo(() => countDiagnostics(diagnostics), [diagnostics]);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const openMenuAt = (event: React.MouseEvent, problem: Diagnostic | null) => {
    event.preventDefault();
    setMenu({ anchor: pointerAnchor(event.clientX, event.clientY), problem });
  };
  const copy = (text: string) => void navigator.clipboard.writeText(text);
  const picked = menu?.problem ?? null;
  const shown = [
    { key: "error" as const, value: counts.errors },
    { key: "warning" as const, value: counts.warnings },
    { key: "information" as const, value: counts.infos },
    { key: "hint" as const, value: counts.hints },
  ].filter((entry) => entry.value > 0);

  // A clean file has no bar at all — the strip appearing is the signal.
  if (problems.length === 0) return null;

  const Chevron = expanded ? IconChevronDown : IconChevronUp;
  return (
    <div className={cn("border-t bg-background", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`Problems: ${problemsLabel(counts)}`}
        onClick={onToggle}
        onContextMenu={(event) => openMenuAt(event, null)}
        className="flex h-7 w-full items-center gap-2 px-3 text-xs text-muted-foreground outline-none hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {shown.map(({ key, value }) => {
            const { icon: Icon, className: tone } = SEVERITY_STYLE[key];
            return (
              <span key={key} className={cn("flex items-center gap-1", tone)}>
                <Icon className="size-3.5" />
                {value}
              </span>
            );
          })}
        </span>
        <span className="flex-1 truncate text-left">
          {/* Collapsed, the worst problem is worth a glance without opening. */}
          {expanded ? "" : problems[0].message}
        </span>
        <Chevron className="size-3.5 shrink-0" />
      </button>
      {expanded && (
        <ul className="max-h-56 overflow-auto border-t">
          {problems.map((problem, index) => {
            const {
              icon: Icon,
              className: tone,
              label,
            } = SEVERITY_STYLE[problem.severity];
            return (
              <li
                // Diagnostics have no identity of their own; position plus
                // code is as stable as it gets, and the list re-renders
                // wholesale anyway.
                key={`${problemPosition(problem)}:${problem.code ?? ""}:${index}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(problem)}
                  onContextMenu={(event) => openMenuAt(event, problem)}
                  className="flex w-full items-start gap-2 px-3 py-1 text-left text-xs leading-relaxed outline-none hover:bg-elevate"
                >
                  <Icon
                    className={cn("mt-0.5 size-3.5 shrink-0", tone)}
                    aria-label={label}
                  />
                  <span className="min-w-0 flex-1 whitespace-pre-wrap text-foreground">
                    {problem.message}
                    <span className="ml-1.5 text-muted-foreground">
                      {problemOrigin(problem)}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {problemPosition(problem)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {menu !== null && (
        <ContextMenu open onOpenChange={(open) => !open && setMenu(null)}>
          <ContextMenuContent
            anchor={menu.anchor}
            side="bottom"
            align="start"
            sideOffset={2}
            className="w-56"
          >
            {picked !== null && (
              <>
                <ContextMenuItem
                  onClick={() => copy(problemText(picked, path ?? null))}
                >
                  <IconClipboardCopy className="size-3.5 text-muted-foreground" />
                  Copy problem
                </ContextMenuItem>
                <ContextMenuItem onClick={() => copy(picked.message)}>
                  <IconClipboardText className="size-3.5 text-muted-foreground" />
                  Copy message
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem
              onClick={() => copy(problemsText(problems, path ?? null))}
            >
              <IconClipboardList className="size-3.5 text-muted-foreground" />
              Copy all problems
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  );
}
