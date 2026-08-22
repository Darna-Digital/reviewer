/**
 * The mode indicator.
 *
 * Modal editing is unusable without one: every keystroke means something
 * different depending on a piece of state that is otherwise only visible as the
 * shape of the caret. The half-typed command rides along with it, so `2d`
 * waiting for a motion is something you can see rather than something you have
 * to remember.
 */
import type { VimState } from "../interfaces/vim.interfaces";
import { modeLabel } from "../functions/vim.functions";
import { cn } from "@/lib/utils";

const TONE: Record<VimState["mode"], string> = {
  normal: "bg-elevate text-muted-foreground",
  insert: "bg-primary/15 text-primary",
  visual: "bg-warning/20 text-warning-foreground",
  "visual-line": "bg-warning/20 text-warning-foreground",
};

export function VimStatus({ state }: { state: VimState }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide",
          TONE[state.mode]
        )}
        aria-label={`Vim mode: ${modeLabel(state)}`}
      >
        {modeLabel(state)}
      </span>
      {state.pending.length > 0 && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {state.pending}
        </span>
      )}
    </span>
  );
}
