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
  IconArrowBarToRight,
  IconCheck,
  IconCloud,
  IconDeviceLaptop,
  IconGitCommit,
  IconGitCompare,
  IconGitMerge,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { handleSearchKeyDown } from "@/components/ui/search-keydown";
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

/**
 * One source, as a row that opens into what can be done with it — the shape the
 * branch picker two crumbs to the left already uses, so the two menus in the
 * same bar are read the same way.
 *
 * Reading it and going to work in it are different acts, and the row used to
 * carry only the first while a button out on the trail carried the second. One
 * of them is about a diff and the other is about a directory; putting both
 * under the thing they are both about is what let the trail lose the button.
 */
const SourceItem = ({
  source,
  current,
  checkedOut,
  onSelect,
  onCheckout,
}: {
  source: DiffSource;
  current: boolean;
  /** The window is already working in this source's tree. */
  checkedOut: boolean;
  onSelect: () => void;
  onCheckout: () => void;
}) => {
  const Icon = diffSourceIcon(source);
  const hint = diffSourceHint(source);
  // Nothing on this machine to stand in. Until somebody fetches it, a pull
  // request is a diff and nothing else.
  const hasTree = source.kind !== "pull";
  const row = (
    <>
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
    </>
  );
  if (!hasTree) {
    return (
      <DropdownMenuItem className="gap-2" onClick={onSelect}>
        {row}
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">{row}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-56">
        <DropdownMenuItem onClick={onSelect}>
          <IconGitCompare className="size-4 shrink-0 text-muted-foreground" />
          Read the changes
        </DropdownMenuItem>
        <DropdownMenuItem disabled={checkedOut} onClick={onCheckout}>
          <IconArrowBarToRight className="size-4 shrink-0 text-muted-foreground" />
          {checkedOut ? "Working here" : "Check out"}
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
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
  checkedOut,
  onSelect,
  onCheckout,
}: {
  sources: ReadonlyArray<DiffSource>;
  current: string;
  /** The key of the source whose tree the window is working in. */
  checkedOut: string | null;
  onSelect: (source: DiffSource) => void;
  onCheckout: (source: DiffSource) => void;
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
                checkedOut={diffSourceKey(source) === checkedOut}
                onSelect={() => onSelect(source)}
                onCheckout={() => onCheckout(source)}
              />
            ))}
          </DropdownMenuGroup>
        ))}
    </>
  );
}

/**
 * The filter box every long menu in this app wears: a plain row rather than a
 * menu item, so typing never navigates and the arrows still walk the rows.
 * Inset out to the panel's edges, since a rule that stops short of them reads
 * as a box inside a box.
 */
export function MenuSearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="-mx-1 -mt-1 mb-1 flex items-center gap-2 border-b px-2.5 py-2">
      <IconSearch className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={ref}
        autoFocus
        data-search-input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleSearchKeyDown}
        placeholder={label}
        aria-label={label}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/**
 * Which branch the changes are read against — and, where the work can be
 * landed, which branch it lands on.
 *
 * The two are one question asked twice: the branch you read a change against is
 * nearly always the branch you mean to put it on. So one list answers both,
 * each row opening into the two things a branch can be to this diff, the way
 * the source list beside it opens into the two things a source can be. There is
 * no separate merge button because there was never a separate list.
 *
 * `own` is the answer that needs no choosing — the branch a worktree lands on,
 * or the one this checkout is aimed at — so it is marked rather than repeated,
 * and choosing it means "stop comparing" rather than "compare with that".
 * `null` from `onSelect` says exactly that.
 */
export function CompareItems({
  branches,
  against,
  own,
  exclude,
  onSelect,
  onUpdate,
  onMerge,
}: {
  branches: ReadonlyArray<string>;
  against: string | null;
  /** What it is read against when nothing has been chosen, if anything. */
  own: string | null;
  /** The branch the changes are *on* — diffing it with itself says nothing. */
  exclude: string | null;
  onSelect: (branch: string | null) => void;
  /**
   * Bring that branch into the work. Offered wherever the work has a worktree
   * to bring it into — including before there are any commits, since falling
   * behind starts the moment somebody else pushes.
   */
  onUpdate?: (branch: string) => void;
  /** Omitted where there is nothing to land — no commits, or not a worktree. */
  onMerge?: (branch: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      branches
        .filter((branch) => branch !== exclude)
        .filter((branch) => q === "" || branch.toLowerCase().includes(q)),
    [branches, exclude, q]
  );
  return (
    <>
      <MenuSearch label="Search branches" value={query} onChange={setQuery} />
      {own === null && q === "" && (
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
      {shown.map((branch) => {
        const row = (
          <>
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
          </>
        );
        if (onUpdate === undefined && onMerge === undefined) {
          return (
            <DropdownMenuItem
              key={branch}
              onClick={() => onSelect(branch === own ? null : branch)}
            >
              {row}
            </DropdownMenuItem>
          );
        }
        return (
          <DropdownMenuSub key={branch}>
            <DropdownMenuSubTrigger>{row}</DropdownMenuSubTrigger>
            {/* Named, not "this". A submenu is read on its own — you got here
                by pointing at a row and the row is now behind the panel — so an
                action that says only "this" is asking you to remember which
                branch you were on. Each row is a menu item, and a menu item
                tooltips whatever it has had to cut off, so the whole name is
                still a hover away. */}
            <DropdownMenuSubContent className="max-w-80 min-w-56">
              <DropdownMenuItem
                onClick={() => onSelect(branch === own ? null : branch)}
              >
                <IconGitCompare className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  Read against ‘{branch}’
                </span>
              </DropdownMenuItem>
              {/* Between reading and landing, because that is where it falls:
                  a branch you are behind cannot be merged into, and this is the
                  one thing that changes that. Naming the same branch all three
                  actions name is the point — catching up and landing are one
                  choice made twice, not two questions. */}
              {onUpdate !== undefined && (
                <DropdownMenuItem onClick={() => onUpdate(branch)}>
                  <IconRefresh className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    Update from ‘{branch}’
                  </span>
                </DropdownMenuItem>
              )}
              {onMerge !== undefined && (
                <DropdownMenuItem onClick={() => onMerge(branch)}>
                  <IconGitMerge className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    Merge into ‘{branch}’
                  </span>
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      })}
      {shown.length === 0 && (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
          No branch matches.
        </p>
      )}
    </>
  );
}
