/**
 * Where this session runs — this machine, or byconvo cloud.
 *
 * The last of the composer's answers, and the same kind of answer as the ones
 * beside it: a statement about the prompt being written, not a move. Picking
 * the cloud changes nothing until you send; then the prompt goes to a run that
 * clones, works and pushes on its own, and this window follows it live.
 *
 * The cloud is only an answer once the app is connected to it, so until then
 * the choice is shown but cannot be made, and says where to go to make it.
 */
import {
  IconCheck,
  IconChevronDown,
  IconCloud,
  IconDeviceLaptop,
  IconBrandGithub,
} from "@tabler/icons-react";
import type { CloudRepo } from "@byconvo/core/cloud";
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
import type { RunTarget } from "../adapters/run-target.store";

const Choice = ({
  label,
  hint,
  chosen,
  disabled = false,
  onSelect,
}: {
  label: string;
  hint: string;
  chosen: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) => (
  <DropdownMenuItem
    className="items-start gap-2"
    disabled={disabled}
    onClick={onSelect}
  >
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

export function RunTargetPicker({
  value,
  onChange,
  cloudConnected,
  side = "top",
}: {
  value: RunTarget;
  onChange: (next: RunTarget) => void;
  /** Whether the cloud can take a session right now. */
  cloudConnected: boolean;
  side?: "top" | "bottom";
}) {
  const Icon = value === "cloud" ? IconCloud : IconDeviceLaptop;
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
                  aria-label="Run target"
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {value === "cloud" ? "byconvo cloud" : "This machine"}
                  </span>
                  <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              }
            />
          }
        />
        <TooltipContent side={side}>
          {value === "cloud"
            ? "This session runs in byconvo cloud, and this window follows it"
            : "This session runs on this machine"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side={side} className="w-80">
        <Choice
          label="This machine"
          hint="Runs the agent here, in the checkout you are standing in."
          chosen={value === "local"}
          onSelect={() => onChange("local")}
        />
        <Choice
          label="byconvo cloud"
          hint={
            cloudConnected
              ? "Clones, works and pushes on its own; you follow it from here."
              : "Connect in Settings to run sessions in the cloud."
          }
          chosen={value === "cloud"}
          disabled={!cloudConnected}
          onSelect={() => onChange("cloud")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Which linked repository a cloud run works in. */
export function CloudRepoPicker({
  repos,
  value,
  onChange,
  side = "top",
}: {
  repos: ReadonlyArray<CloudRepo>;
  value: CloudRepo | null;
  onChange: (id: string) => void;
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
                  className="max-w-56 shrink-0 gap-2 px-2 py-1.5"
                  aria-label="Which cloud repository this session runs in"
                >
                  <IconBrandGithub className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {value === null ? "No repository linked" : value.fullName}
                  </span>
                  <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </Button>
              }
            />
          }
        />
        <TooltipContent side={side}>
          {value === null
            ? "Link a repository in byconvo cloud first"
            : `Clones ${value.fullName} and works on a branch of it`}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" side={side} className="w-80">
        {repos.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No repositories are linked in byconvo cloud yet.
          </div>
        ) : (
          repos.map((repo) => (
            <Choice
              key={repo.id}
              label={repo.fullName}
              hint={`Starts from ${repo.defaultBranch} unless a branch is named.`}
              chosen={value?.id === repo.id}
              onSelect={() => onChange(repo.id)}
            />
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
