/**
 * What the diff above is looking at, as a menu.
 *
 * It hangs off the breadcrumb rather than sitting in a bar of its own, because
 * the crumb already answers the question in words — "Local changes", "#41" —
 * and a crumb that names the answer is the natural place to change it. That is
 * what makes local work and a pull request one view instead of two: the pane
 * never changes, only the crumb does.
 *
 * What your own changes are read *against* is the header row's compare picker,
 * which is offered whether or not anything has been chosen — see
 * `interactions/comparison`.
 */
import {
  IconArrowBarToRight,
  IconCheck,
  IconCloud,
  IconGitCommit,
  IconGitCompare,
  IconSearch,
} from "@tabler/icons-react";
import { useRef } from "react";
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
  source.kind === "local" ? IconGitCommit : IconCloud;

const GROUP_LABEL: Readonly<Record<DiffSource["kind"], string>> = {
  local: "This checkout",
  pull: "Pull requests",
};

/**
 * One source, as a row that opens into what can be done with it — the shape the
 * branch picker two crumbs to the left already uses, so the two menus in the
 * same bar are read the same way.
 *
 * Reading it and going to work in it are different acts, and the row used to
 * carry only the first while a button out on the trail carried the second. One
 * of them is about a diff and the other is about a checkout; putting both
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
 * Grouped by kind rather than listed flat. The two are different in a way that
 * matters — one is on disk in front of you, one is on somebody's server — and a
 * heading says so once instead of every row having to carry it.
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
  const kinds: ReadonlyArray<DiffSource["kind"]> = ["local", "pull"];
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
