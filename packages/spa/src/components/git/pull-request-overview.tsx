/**
 * Everything about the open pull request that is not its diff: who wrote it and
 * who is on it, where it is going, what CI made of it, and what its author said
 * it was for — plus what a reviewer does to it: checking it out, merging it,
 * or closing it unmerged.
 *
 * It is the first of the three columns a pull request under review is read in:
 * this, then its files, then its diff. It takes the place the list was in
 * before a row was picked, and carries the way back to it.
 *
 * The column reads down a spine: identity — title, byline, branches and the
 * figures the pull request is sized by on one strip — then the actions, then
 * the checks, who is on it, and what its author wrote. Only Details keeps a
 * legend, because only Details is a label gutter; the checks are a verdict you
 * open, and the description is prose. Type is the app's own four steps and
 * nothing else: `type-ui` for controls, `type-body` for the sentences the
 * description is made of, `type-xs` for values, `type-meta` for the captions
 * and legends.
 */
import {
  IconAlertTriangleFilled,
  IconArrowLeft,
  IconArrowNarrowRight,
  IconBrandGithub,
  IconCheck,
  IconChevronDown,
  IconGitFork,
  IconGitMerge,
  IconGitPullRequest,
  IconGitPullRequestClosed,
  IconGitPullRequestDraft,
  IconListTree,
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
  checksHeadline,
  checksTally,
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
  return <div className="mb-2 type-meta text-muted-foreground">{children}</div>;
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

/**
 * One row of a section: a name on the left, its figure on the right.
 *
 * Both sections are made of this and nothing else, which is the point. They
 * used to be two shapes side by side — checks as a list with a right-aligned
 * verdict, details as a label gutter with values ragging off it — and two
 * alignments in adjacent sections is what made a column of short facts read as
 * unproportioned. One shape gives the whole column a left edge and a right one.
 */
function Row({
  label,
  value,
  lead,
  wrap = false,
}: {
  readonly label: React.ReactNode;
  readonly value: React.ReactNode;
  /** A glyph before the label — the check dot, on a status row. */
  readonly lead?: React.ReactNode;
  /** Let a wide value (badges, avatars) wrap under itself rather than squash. */
  readonly wrap?: boolean;
}) {
  return (
    <div className="flex min-h-5 items-baseline justify-between gap-3 py-px">
      <span className="flex min-w-0 items-baseline gap-2">
        {lead}
        <span className="truncate type-meta text-muted-foreground">
          {label}
        </span>
      </span>
      <span
        className={cn(
          "flex min-w-0 shrink-0 items-center justify-end gap-1.5 type-xs",
          wrap && "flex-wrap"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A check's verdict as a dot, boxed to the width of the icon the summary above
 * it wears, so a list of checks hangs on the edge the headline starts on.
 */
function CheckDot({ state }: { readonly state: CheckState }) {
  return (
    <span className="flex w-3.5 shrink-0 justify-center">
      <span
        className={cn(
          "size-1.5 translate-y-[-2px] rounded-full",
          CHECK_DOT[state]
        )}
      />
    </span>
  );
}

function People({ people }: { readonly people: ReadonlyArray<string> }) {
  return (
    <>
      {people.slice(0, 3).map((person) => (
        <Avatar key={person} name={person} letters={1} className="size-4" />
      ))}
      <span className="truncate">{people.join(", ")}</span>
    </>
  );
}

export function PullRequestOverview({
  pull,
  currentBranch,
  onCheckout,
  onMerge,
  onClose,
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
  /**
   * Land the pull request. Answers whether it went through: a merged pull
   * request is no longer one of the open ones, so the window leaves for the
   * list rather than sitting on a page that has stopped being true.
   */
  readonly onMerge: (
    pull: PullRequestInfo,
    method: MergeMethod
  ) => Promise<boolean>;
  /**
   * Close the pull request without merging it. Answers the same question
   * merging does — whether it went through — because a closed pull request
   * leaves the open list the same way a merged one does.
   */
  readonly onClose: (pull: PullRequestInfo) => Promise<boolean>;
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
  const [closing, setClosing] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const localBranch = localBranchForPull(pull);
  const onBranch = currentBranch === localBranch;
  const counts = countChecks(pull);
  const headline = checksHeadline(pull);
  const tally = checksTally(pull);
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
    void onMerge(pull, method)
      .then((merged) => {
        // The column is about a pull request that is now closed, and the tree
        // and diff beside it are about a diff that has landed. Nothing here
        // says anything true any more, so it goes back to the list — which is
        // also where the merged row disappearing is worth seeing.
        if (merged) onBack();
      })
      .finally(() => setMerging(false));
  };

  const runClose = () => {
    setConfirmingClose(false);
    setClosing(true);
    void onClose(pull)
      .then((closed) => {
        // Same as a merge: nothing in the three columns is true of an open
        // pull request any more, so the window goes back to the list.
        if (closed) onBack();
      })
      .finally(() => setClosing(false));
  };

  const StateIcon = pull.draft ? IconGitPullRequestDraft : IconGitPullRequest;
  const hasDetails =
    pull.assignees.length > 0 ||
    pull.reviewers.length > 0 ||
    pull.labels.length > 0;

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
          Back to list
        </Button>
        {/* The tree is the column immediately to the right of this one. It
            stays put in both states and reports which one it is in, rather
            than swapping to a second icon the eye has to re-read. */}
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
            <IconListTree />
          </TooltipTrigger>
          <TooltipContent>
            {treeVisible ? "Hide file tree" : "Show file tree"}
          </TooltipContent>
        </Tooltip>
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
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 type-meta text-muted-foreground">
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
              single fact — this goes there — so it gets a single object. The
              fill stops where the two names stop: a bar drawn to the column's
              width would be sizing the object by the pane rather than by what
              is written on it. */}
          <div className="flex min-w-0 items-center gap-1.5 self-start rounded-md bg-muted px-2 py-1 font-mono type-meta">
            <span className="truncate">{pull.headRef}</span>
            <IconArrowNarrowRight className="size-3 shrink-0 text-muted-foreground" />
            <span className="shrink-0">{pull.baseRef}</span>
            {pull.fromFork && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      className="flex shrink-0 items-center"
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
          {/* The size of the thing, on one line under the branches. These
              were rows in Details before, which spent a hairline-separated
              band on two facts that are one glance — and pushed the
              description off the bottom of a column that had said almost
              nothing yet. The checks stay out of it: they have their own row
              directly below, and a verdict said twice is a verdict read
              neither time. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-meta text-muted-foreground">
            {pull.changedFiles > 0 && (
              <span className="tabular-nums">
                {pull.changedFiles} file{pull.changedFiles === 1 ? "" : "s"}{" "}
                <span className="text-success">+{pull.additions}</span>{" "}
                <span className="text-destructive">−{pull.deletions}</span>
              </span>
            )}
            {pull.createdAt.length > 0 && (
              <span>opened {timeAgo(pull.createdAt)} ago</span>
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
          {/* Closing is the one thing in this row that takes the pull request
              away rather than doing something with it, so it keeps the quiet
              icon face the GitHub link has and says so only on hover, where
              the red is a warning rather than a fourth thing competing for
              the row. It is confirmed like the merge is, for the same reason:
              everyone else sees it happen. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Close #${pull.number} without merging`}
                  disabled={closing || merging}
                  onClick={() => setConfirmingClose(true)}
                  className="text-muted-foreground hover:text-destructive"
                />
              }
            >
              <IconGitPullRequestClosed className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              {closing ? "Closing…" : `Close #${pull.number} without merging.`}
            </TooltipContent>
          </Tooltip>
          {/* An anchor wearing the button's face rather than a Button
              rendering an anchor: this navigates, so it should be a link the
              browser knows how to open in a window of its own. It sits with
              the other two because it is the third thing you do with a pull
              request — merge it, check it out, or go and look at it. */}
          {pull.url.length > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    href={pull.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open #${pull.number} on GitHub`}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                    })}
                  />
                }
              >
                <IconBrandGithub className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Open on GitHub</TooltipContent>
            </Tooltip>
          )}
        </div>

        {(blocked !== null || headline !== null) && (
          <section className="border-t p-3">
            {/* The blocker gets a line of prose rather than only the icon it
                shares with the picker: this is the pane you are in when you
                find out, and "why" is the next thing you would ask. */}
            {blocked !== null && (
              <p className="mb-2 flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 p-2 type-xs font-normal text-pretty text-warning-foreground dark:text-warning">
                <IconAlertTriangleFilled className="mt-px size-3.5 shrink-0 text-warning" />
                <span>{blocked}</span>
              </p>
            )}

            {/* The verdict is the row; the runs behind it are what you open
                when the verdict is not enough. Green folds itself away — a
                red or still-running one opens, because that is the one you
                came here to read. */}
            {headline !== null && (
              <details
                open={counts.failed > 0 || counts.pending > 0}
                className="group"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 type-xs select-none [&::-webkit-details-marker]:hidden">
                  <ChecksIcon pull={pull} />
                  <span className="min-w-0 flex-1 truncate">{headline}</span>
                  <span className="type-meta text-muted-foreground tabular-nums">
                    {tally}
                  </span>
                  <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                {/* The list hangs on the summary's own two edges: `CheckDot`
                    holds the icon's width on the left, and the strip the
                    chevron occupies is kept clear on the right, so names line
                    up under the headline and verdicts under the tally. */}
                <div className="mt-1.5 pr-5.5">
                  {orderedChecks.slice(0, CHECKS_SHOWN).map((check) => (
                    <Row
                      key={`${check.name}-${check.url}`}
                      lead={<CheckDot state={check.state} />}
                      label={
                        check.url.length > 0 ? (
                          <a
                            href={check.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link hover:underline"
                          >
                            {check.name}
                          </a>
                        ) : (
                          check.name
                        )
                      }
                      value={
                        <span className="type-meta text-muted-foreground">
                          {CHECK_WORD[check.state]}
                        </span>
                      }
                    />
                  ))}
                  {counts.total > CHECKS_SHOWN && (
                    <Row
                      lead={<span className="w-3.5 shrink-0" />}
                      label={
                        <a
                          href={`${pull.url}/checks`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-link hover:underline"
                        >
                          {counts.total - CHECKS_SHOWN} more on GitHub
                        </a>
                      }
                      value={null}
                    />
                  )}
                </div>
              </details>
            )}
          </section>
        )}

        {hasDetails && (
          <Section legend="Details">
            {pull.assignees.length > 0 && (
              <Row
                label="Assignees"
                wrap
                value={<People people={pull.assignees} />}
              />
            )}
            {pull.reviewers.length > 0 && (
              <Row
                label="Reviewers"
                wrap
                value={<People people={pull.reviewers} />}
              />
            )}
            {pull.labels.length > 0 && (
              <Row
                label="Labels"
                wrap
                value={pull.labels.map((label) => (
                  <Badge
                    key={label.name}
                    variant="outline"
                    className="h-[18px] px-1.5 type-meta font-normal"
                    style={labelStyle(label.color)}
                  >
                    {label.name}
                  </Badge>
                ))}
              />
            )}
          </Section>
        )}

        {/* The one place in the column made of sentences rather than labels,
            so the one place that reads at `type-body`'s weight — and the one
            place that goes without a legend, because prose under a caption
            reads as a field rather than as what the author wrote. */}
        {pull.body.trim().length > 0 && (
          <section className="border-t p-3 pb-6">
            <div className="markdown min-w-0 type-body">
              <ChatMarkdown text={pull.body} />
            </div>
          </section>
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

      {/* Closing is undone by reopening it on GitHub rather than by anything
          here, and the branch it was opened from is untouched either way —
          which is the pair of facts that decide whether to go through with
          it, so it is the pair the confirmation says. */}
      <Dialog open={confirmingClose} onOpenChange={setConfirmingClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close #{pull.number} without merging?</DialogTitle>
            <DialogDescription>
              {pull.headRef} keeps its commits and stays where it is. Reopening
              #{pull.number} is done on GitHub.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button variant="destructive" onClick={runClose}>
              Close pull request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
