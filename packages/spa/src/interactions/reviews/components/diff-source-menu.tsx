/**
 * The two questions the trail asks above a diff, as menus: what am I looking
 * at, and what is it read against.
 *
 * Both hang off the breadcrumb rather than sitting in a bar of their own,
 * because both are already answered there in words — "Local changes", "vs
 * master" — and a crumb that names the answer is the natural place to change
 * it. That is what makes local work, a worktree and a pull request one view
 * instead of three: the pane never changes, only the crumb does.
 */
import {
  IconCheck,
  IconCloud,
  IconDeviceLaptop,
  IconGitCommit,
} from "@tabler/icons-react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  diffSourceHint,
  diffSourceKey,
  diffSourceLabel,
  type DiffSource,
} from "../functions/reviews.functions";

export const diffSourceIcon = (source: DiffSource) =>
  source.kind === "local"
    ? IconGitCommit
    : source.kind === "worktree"
      ? IconDeviceLaptop
      : IconCloud;

const GROUP_LABEL: Readonly<Record<DiffSource["kind"], string>> = {
  local: "Main worktree",
  worktree: "Worktrees",
  pull: "Pull requests",
};

const SourceItem = ({
  source,
  current,
  onSelect,
}: {
  source: DiffSource;
  current: boolean;
  onSelect: () => void;
}) => {
  const Icon = diffSourceIcon(source);
  const hint = diffSourceHint(source);
  return (
    <DropdownMenuItem className="gap-2" onClick={onSelect}>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{diffSourceLabel(source)}</span>
        {hint !== null && (
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
      <IconCheck
        className={cn("size-4 shrink-0", current ? "opacity-100" : "opacity-0")}
      />
    </DropdownMenuItem>
  );
};

/**
 * Grouped by kind rather than listed flat. The three are different in a way
 * that matters — one is on disk in front of you, one is running beside you, one
 * is on somebody's server — and a heading says so once instead of every row
 * having to carry it.
 */
export function DiffSourceItems({
  sources,
  current,
  onSelect,
}: {
  sources: ReadonlyArray<DiffSource>;
  current: string;
  onSelect: (source: DiffSource) => void;
}) {
  const kinds: ReadonlyArray<DiffSource["kind"]> = [
    "local",
    "worktree",
    "pull",
  ];
  return (
    <>
      {kinds
        .map((kind) => ({
          kind,
          items: sources.filter((source) => source.kind === kind),
        }))
        .filter((group) => group.items.length > 0)
        .map((group, index) => (
          <DropdownMenuGroup key={group.kind}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{GROUP_LABEL[group.kind]}</DropdownMenuLabel>
            {group.items.map((source) => (
              <SourceItem
                key={diffSourceKey(source)}
                source={source}
                current={diffSourceKey(source) === current}
                onSelect={() => onSelect(source)}
              />
            ))}
          </DropdownMenuGroup>
        ))}
    </>
  );
}

/**
 * Which branch the changes are read against.
 *
 * `own` is the answer that needs no choosing — the branch a task lands on, or
 * the one this checkout is aimed at — so it is marked rather than repeated, and
 * choosing it means "stop comparing" rather than "compare with that". `null`
 * from `onSelect` says exactly that.
 */
export function CompareItems({
  branches,
  against,
  own,
  exclude,
  onSelect,
}: {
  branches: ReadonlyArray<string>;
  against: string | null;
  /** What it is read against when nothing has been chosen, if anything. */
  own: string | null;
  /** The branch the changes are *on* — diffing it with itself says nothing. */
  exclude: string | null;
  onSelect: (branch: string | null) => void;
}) {
  return (
    <>
      {own === null && (
        <DropdownMenuItem onClick={() => onSelect(null)}>
          <span className="min-w-0 flex-1 truncate">Uncommitted only</span>
          <IconCheck
            className={cn(
              "size-4 shrink-0",
              against === null ? "opacity-100" : "opacity-0"
            )}
          />
        </DropdownMenuItem>
      )}
      {branches
        .filter((branch) => branch !== exclude)
        .map((branch) => (
          <DropdownMenuItem
            key={branch}
            onClick={() => onSelect(branch === own ? null : branch)}
          >
            <span className="min-w-0 flex-1 truncate">{branch}</span>
            {branch === own && (
              <span className="shrink-0 text-xs text-muted-foreground">
                lands here
              </span>
            )}
            <IconCheck
              className={cn(
                "size-4 shrink-0",
                branch === (against ?? own) ? "opacity-100" : "opacity-0"
              )}
            />
          </DropdownMenuItem>
        ))}
    </>
  );
}
