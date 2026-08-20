/**
 * Everything about the open pull request that is not its diff: who wrote it and
 * who is on it, where it is going, what CI made of it, and what its author said
 * it was for — plus the two things a reviewer does to it, checking it out and
 * merging it.
 *
 * It is the first of the three columns a pull request under review is read in:
 * this, then its files, then its diff. It takes the place the list was in
 * before a row was picked, and carries the way back to it.
 *
 * The column reads down a spine: identity, then the actions, then Status,
 * Details and Description, each behind a hairline and an uppercase legend.
 * Facts are laid on a label gutter rather than run together in a paragraph of
 * chips — before that, assignees, reviewers and labels each began wherever the
 * row above them happened to end, which is what made a short column feel like
 * a pile. Type is the app's own four steps and nothing else: `type-ui` for
 * controls, `type-body` for the sentences the description is made of, `type-xs`
 * for values, `type-meta` for the captions and legends.
 */
import {
  IconAlertTriangleFilled,
  IconArrowLeft,
  IconArrowNarrowRight,
  IconCheck,
  IconChevronDown,
  IconExternalLink,
  IconGitFork,
  IconGitMerge,
  IconGitPullRequest,
  IconGitPullRequestDraft,
  IconLayoutSidebarRight,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChecksIcon } from "@/components/git/pull-request-status";
import {
  blockedReason,
  checksSummary,
  countChecks,
  localBranchForPull,
  mergeBlockedReason,
  mergeCaution,
} from "@/components/git/pull-requests.functions";
import { ChatMarkdown } from "@/interactions/chats/components/chat-markdown";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type {
  CheckState,
  MergeMethod,
  PullRequestInfo,
} from "@byconvo/core/ports/git-provider";

/** How many check rows are listed before the rest are counted instead. */
const CHECKS_SHOWN = 6;

const CHECK_DOT = {
  success: "bg-success",
  failure: "bg-destructive",
  pending: "bg-warning",
  neutral: "bg-muted-foreground/50",
} as const satisfies Record<CheckState, string>;

const CHECK_WORD = {
  success: "passed",
  failure: "failed",
  pending: "running",
  neutral: "skipped",
} as const satisfies Record<CheckState, string>;

const MERGE_METHODS: ReadonlyArray<{
  readonly method: MergeMethod;
  readonly label: string;
  readonly detail: string;
}> = [
  {
    method: "merge",
    label: "Merge commit",
    detail: "Keeps every commit, under one merge",
  },
  { method: "squash", label: "Squash and merge", detail: "One commit for all" },
  { method: "rebase", label: "Rebase and merge", detail: "Replay, no merge" },
];

/** GitHub gives label colours as bare hex; a label with none falls back. */
const labelStyle = (color: string) =>
  /^[0-9a-fA-F]{6}$/.test(color)
    ? {
        backgroundColor: `#${color}20`,
        color: `#${color}`,
        borderColor: `#${color}55`,
      }
    : undefined;

/** The legend a section reads under — the column's spine. */
function Legend({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 type-meta tracking-[0.4px] text-muted-foreground uppercase">
      {children}
    </div>
  );
}

function Section({
  legend,
  className,
  children,
}: {
  readonly legend: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={cn("border-t p-3", className)}>
      <Legend>{legend}</Legend>
      {children}
    </section>
  );
}

/** One row of the details list: a fixed label gutter, then the value. */
function Row({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <>
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 type-xs">{children}</dd>
    </>
  );
}

function People({ people }: { readonly people: ReadonlyArray<string> }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {people.slice(0, 3).map((person) => (
        <Avatar key={person} name={person} letters={1} className="size-4" />
      ))}
      <span className="truncate">{people.join(", ")}</span>
    </span>
  );
}

export function PullRequestOverview({
  pull,
  currentBranch,
  onCheckout,
  onMerge,
  onBack,
  treeVisible,
  onToggleTree,
  className,
  style,
}: {
  readonly pull: PullRequestInfo;
  /** The branch the working copy is on, so the button can say you are on it. */
  readonly currentBranch: string | null;
  readonly onCheckout: (pull: PullRequestInfo, branch: string) => Promise<void>;
  readonly onMerge: (
    pull: PullRequestInfo,
    method: MergeMethod
  ) => Promise<void>;
  /** Back to the list of pull requests, which this column replaced. */
  readonly onBack: () => void;
  /** Whether the file tree column beside this one is showing. */
  readonly treeVisible: boolean;
  readonly onToggleTree: () => void;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [merging, setMerging] = useState(false);
  const [confirming, setConfirming] = useState<MergeMethod | null>(null);

  const localBranch = localBranchForPull(pull);
  const onBranch = currentBranch === localBranch;
  const counts = countChecks(pull);
  const summary = checksSummary(pull);
  const blocked = blockedReason(pull);
  const mergeBlocked = mergeBlockedReason(pull);
  const caution = mergeCaution(pull);

  // Failures and still-running checks first: the list is capped, and the ones
  // worth the room are the ones that have something to say.
  const orderedChecks = useMemo(() => {
    const rank: Record<CheckState, number> = {
      failure: 0,
      pending: 1,
      neutral: 2,
      success: 3,
    };
    return [...pull.checks].sort((a, b) => rank[a.state] - rank[b.state]);
  }, [pull.checks]);

  const runMerge = (method: MergeMethod) => {
    setConfirming(null);
    setMerging(true);
    void onMerge(pull, method).finally(() => setMerging(false));
  };

  const StateIcon = pull.draft ? IconGitPullRequestDraft : IconGitPullRequest;

  return (
    <section
      className={cn("flex min-h-0 flex-col overflow-hidden", className)}
      style={style}
      aria-label={`Pull request #${pull.number}`}
    >
      {/* The way back, and the way out to GitHub. One row, the height of the
          tree's search field beside it, so the three columns start level. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b py-1 pr-1.5 pl-1">
        <Button
          variant="ghost-muted"
          size="xs"
          className="gap-1.5"
          onClick={onBack}
        >
          <IconArrowLeft className="size-3.5 shrink-0" />
          Pull requests
        </Button>
        <div className="flex shrink-0 items-center gap-0.5">
          {pull.url.length > 0 && (
            <Tooltip>
              {/* An anchor wearing the button's face rather than a Button
                  rendering an anchor: this navigates, so it should be a link
                  the browser knows how to open in a new window. */}
              <TooltipTrigger
                render={
                  <a
                    href={pull.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open #${pull.number} on GitHub`}
                    className={buttonVariants({
                      variant: "ghost-muted",
                      size: "icon-xs",
                    })}
                  />
                }
              >
                <IconExternalLink />
              </TooltipTrigger>
              <TooltipContent>Open on GitHub</TooltipContent>
            </Tooltip>
          )}
          {/* The tree is the column immediately to the right of this one, and
              the icon says so — a panel toggle, not a file glyph. It stays put
              in both states and reports which one it is in, rather than
              swapping to a second icon the eye has to re-read. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost-muted"
                  size="icon-xs"
                  aria-pressed={treeVisible}
                  aria-label={treeVisible ? "Hide file tree" : "Show file tree"}
                  onClick={onToggleTree}
                  className={cn(treeVisible && "text-foreground")}
                />
              }
            >
              <IconLayoutSidebarRight />
            </TooltipTrigger>
            <TooltipContent>
              {treeVisible ? "Hide file tree" : "Show file tree"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        {/* Identity. The title is the one step above the control type in the
            column, and every fact under it is type-meta, so the eye lands on
            the title and the rest reads as one band rather than four lines
            competing for the same weight. */}
        <header className="flex flex-col gap-2 p-3">
          <div className="flex items-start gap-2">
            <StateIcon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                pull.draft ? "text-muted-foreground" : "text-success"
              )}
              aria-label={pull.draft ? "Draft" : "Open"}
            />
            <h2 className="min-w-0 flex-1 text-sm/5 font-medium tracking-[-0.1px] text-pretty">
              {pull.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-6 type-meta text-muted-foreground">
            <span className="font-mono">#{pull.number}</span>
            {pull.author.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <Avatar name={pull.author} letters={1} className="size-4" />
                <span>{pull.author}</span>
              </>
            )}
            {pull.updatedAt.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>updated {timeAgo(pull.updatedAt)}</span>
              </>
            )}
          </div>
          {/* The branch pair as one rail rather than a loose line: it is a
              single fact — this goes there — so it gets a single object. */}
          <div className="ml-6 flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono type-meta">
            <span className="truncate">{pull.headRef}</span>
            <IconArrowNarrowRight className="size-3 shrink-0 text-muted-foreground" />
            <span className="shrink-0">{pull.baseRef}</span>
            {pull.fromFork && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      className="ml-auto flex shrink-0 items-center"
                      aria-label="Opened from a fork"
                    />
                  }
                >
                  <IconGitFork className="size-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Opened from a fork</TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>

        {/* One filled action per view is the house rule, so Merge is the only
            dark control in the column and Check out recedes beside it. */}
        <div className="flex gap-1.5 px-3 pb-3">
          <div className="flex min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    className="min-w-0 flex-1 gap-1.5 rounded-r-none"
                    disabled={mergeBlocked !== null || merging}
                    onClick={() => setConfirming("merge")}
                  />
                }
              >
                <IconGitMerge className="size-3.5 shrink-0" />
                <span className="truncate">
                  {merging ? "Merging…" : "Merge"}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {mergeBlocked ??
                  `Merge #${pull.number} into ${pull.baseRef} on GitHub.`}
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    aria-label="Merge method"
                    className="-ml-px rounded-l-none border-l border-l-primary-foreground/20"
                    disabled={mergeBlocked !== null || merging}
                  />
                }
              >
                <IconChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {MERGE_METHODS.map(({ method, label, detail }) => (
                  <DropdownMenuItem
                    key={method}
                    onClick={() => setConfirming(method)}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span>{label}</span>
                      <span className="type-meta text-muted-foreground">
                        {detail}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-0 flex-1 gap-1.5"
                  disabled={onBranch || checkingOut}
                  onClick={() => {
                    setCheckingOut(true);
                    void onCheckout(pull, localBranch).finally(() =>
                      setCheckingOut(false)
                    );
                  }}
                />
              }
            >
              {onBranch ? (
                <IconCheck className="size-3.5 shrink-0" />
              ) : (
                <IconGitFork className="size-3.5 shrink-0" />
              )}
              <span className="truncate">
                {onBranch
                  ? "Checked out"
                  : checkingOut
                    ? "Checking out…"
                    : "Check out"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {onBranch
                ? `The working copy is already on ${localBranch}.`
                : pull.fromFork
                  ? `Fetch #${pull.number} from the fork it was opened from and check it out as ${localBranch}.`
                  : `Fetch ${pull.headRef} from origin and check it out. An existing local branch is fast-forwarded, never reset.`}
            </TooltipContent>
          </Tooltip>
        </div>

        {(blocked !== null || summary !== null) && (
          <Section legend="Status">
            {/* The blocker gets a line of prose rather than only the icon it
                shares with the picker: this is the pane you are in when you
                find out, and "why" is the next thing you would ask. */}
            {blocked !== null && (
              <p className="mb-2 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 p-2 type-xs font-normal text-pretty text-warning-foreground dark:text-warning">
                <IconAlertTriangleFilled className="mt-px size-3.5 shrink-0 text-warning" />
                <span>{blocked}</span>
              </p>
            )}

            {summary !== null && (
              <>
                <div className="mb-1 flex items-center gap-1.5 type-xs">
                  <ChecksIcon pull={pull} />
                  <span>{summary}</span>
                </div>
                <ul className="flex flex-col">
                  {orderedChecks.slice(0, CHECKS_SHOWN).map((check) => (
                    <li
                      key={`${check.name}-${check.url}`}
                      className="flex h-5 items-center gap-2 type-meta"
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          CHECK_DOT[check.state]
                        )}
                      />
                      {check.url.length > 0 ? (
                        <a
                          href={check.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-link hover:underline"
                        >
                          {check.name}
                        </a>
                      ) : (
                        <span className="truncate">{check.name}</span>
                      )}
                      <span className="ml-auto shrink-0 text-muted-foreground">
                        {CHECK_WORD[check.state]}
                      </span>
                    </li>
                  ))}
                </ul>
                {counts.total > CHECKS_SHOWN && (
                  <a
                    href={`${pull.url}/checks`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block type-meta text-link hover:underline"
                  >
                    {counts.total - CHECKS_SHOWN} more on GitHub
                  </a>
                )}
              </>
            )}
          </Section>
        )}

        {/* A label gutter, so every value starts on the same x. */}
        <Section legend="Details">
          <dl className="grid grid-cols-[68px_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-2">
            {pull.assignees.length > 0 && (
              <Row label="Assignees">
                <People people={pull.assignees} />
              </Row>
            )}
            {pull.reviewers.length > 0 && (
              <Row label="Reviewers">
                <People people={pull.reviewers} />
              </Row>
            )}
            {pull.labels.length > 0 && (
              <Row label="Labels">
                <span className="flex flex-wrap gap-1">
                  {pull.labels.map((label) => (
                    <Badge
                      key={label.name}
                      variant="outline"
                      className="h-[18px] px-1.5 type-meta font-normal"
                      style={labelStyle(label.color)}
                    >
                      {label.name}
                    </Badge>
                  ))}
                </span>
              </Row>
            )}
            {pull.changedFiles > 0 && (
              <Row label="Changes">
                <span className="tabular-nums">
                  {pull.changedFiles} file{pull.changedFiles === 1 ? "" : "s"}{" "}
                  <span className="text-success">+{pull.additions}</span>{" "}
                  <span className="text-destructive">−{pull.deletions}</span>
                </span>
              </Row>
            )}
            {pull.createdAt.length > 0 && (
              <Row label="Opened">{timeAgo(pull.createdAt)} ago</Row>
            )}
          </dl>
        </Section>

        {/* The one place in the column made of sentences rather than labels,
            so the one place that reads at `type-body`'s weight. */}
        {pull.body.trim().length > 0 && (
          <Section legend="Description" className="pb-6">
            <div className="markdown min-w-0 type-body">
              <ChatMarkdown text={pull.body} />
            </div>
          </Section>
        )}
      </ScrollArea>

      {/* Merging is outward-facing and not ours to undo, so it is confirmed —
          and the confirmation is where the reasons to think twice that are not
          reasons to refuse (a red check, a mergeability GitHub has not worked
          out) finally get said. */}
      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Merge #{pull.number} into {pull.baseRef}?
            </DialogTitle>
            <DialogDescription>
              This merges {pull.headRef} on GitHub as a{" "}
              {MERGE_METHODS.find(
                (m) => m.method === (confirming ?? "merge")
              )?.label.toLowerCase() ?? "merge commit"}
              .{caution !== null && ` ${caution}`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button onClick={() => runMerge(confirming ?? "merge")}>
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
