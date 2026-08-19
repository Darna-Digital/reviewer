/**
 * Where this session runs — the last of the composer's three answers, after the
 * project it is in and the branch it starts from.
 *
 * Two answers, because there are only two: the checkout you are standing in, or
 * a worktree cut for this prompt alone. Everything else about a worktree — what
 * it is called, where it lands, when it goes away — is derived from the prompt
 * and the branch already named to the left, so nothing is asked for here that
 * the composer does not already know.
 *
 * Picking the second one changes nothing until you send. It is a statement about
 * the prompt you are writing, not a move: the app stays where it is, and the
 * task is read back from the review like any pull request.
 */
import { IconCheck, IconChevronDown, IconGitFork } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RunLocation } from "../adapters/run-location.store";

const Choice = ({
  label,
  hint,
  chosen,
  onSelect,
}: {
  label: string;
  hint: string;
  chosen: boolean;
  onSelect: () => void;
}) => (
  <DropdownMenuItem className="items-start gap-2" onClick={onSelect}>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{label}</span>
      <span className="text-xs text-pretty text-muted-foreground">{hint}</span>
    </span>
    <IconCheck
      className={cn(
        "mt-0.5 size-4 shrink-0",
        chosen ? "opacity-100" : "opacity-0"
      )}
    />
  </DropdownMenuItem>
);

export function RunLocationPicker({
  value,
  onChange,
  here,
  base,
  side = "top",
}: {
  value: RunLocation;
  onChange: (next: RunLocation) => void;
  /** What the checkout you are standing in is called. */
  here: string;
  /** The branch a new worktree would be cut from, and aimed back at. */
  base: string | null;
  side?: "top" | "bottom";
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="chip"
                  className="max-w-48 shrink-0 gap-2 px-2 py-1.5"
                  aria-label="Which worktree this session runs in"
                >
                  <IconGitFork className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {value === "here" ? here : "New worktree"}
                  </span>
                  <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              }
            />
          }
        />
        <TooltipContent side={side}>
          {value === "here"
            ? "This session works in the checkout you are in"
            : "This session gets a worktree of its own, so it cannot touch your work"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side={side} className="w-80">
        <Choice
          label={here}
          hint="Works in the checkout you are standing in."
          chosen={value === "here"}
          onSelect={() => onChange("here")}
        />
        <Choice
          label="New worktree"
          hint={
            base === null
              ? "Cuts a branch for this prompt and works there, beside you."
              : `Cuts a branch for this prompt from ‘${base}’ and works there, beside you.`
          }
          chosen={value === "worktree"}
          onSelect={() => onChange("worktree")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
