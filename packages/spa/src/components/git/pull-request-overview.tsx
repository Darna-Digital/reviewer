/**
 * Everything about the open pull request that is not its diff: who wrote it and
 * who is on it, where it is going, what CI made of it, and what its author said
 * it was for.
 *
 * It is the first of the three columns a pull request under review is read in:
 * this, then its files, then its diff. It takes the place the list was in
 * before a row was picked, and carries the way back to it — what the reviewer
 * needs beside the code is the frame it is being read in (is this a draft, is
 * CI red, does it conflict, what is it supposed to do), and until now the only
 * way to get any of that was to leave for the browser.
 */
import {
  IconAlertTriangleFilled,
  IconArrowLeft,
  IconArrowNarrowRight,
  IconCheck,
  IconExternalLink,
  IconGitBranch,
  IconGitPullRequest,
  IconGitPullRequestDraft,
  IconUsers,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/git/pull-requests.functions";
import { ChatMarkdown } from "@/interactions/chats/components/chat-markdown";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type {
  CheckState,
  PullRequestInfo,
} from "@byconvo/core/ports/git-provider";

/** How many check rows are listed before the rest are counted instead. */
const CHECKS_SHOWN = 6;

const CHECK_DOT = {
  success: "bg-emerald-500",
  failure: "bg-destructive",
  pending: "bg-amber-500",
  neutral: "bg-muted-foreground/50",
} as const satisfies Record<CheckState, string>;

/** GitHub gives label colours as bare hex; a label with none falls back. */
const labelStyle = (color: string) =>
  /^[0-9a-fA-F]{6}$/.test(color)
    ? {
        backgroundColor: `#${color}20`,
        color: `#${color}`,
        borderColor: `#${color}55`,
      }
    : undefined;

function People({
  icon: Icon,
  label,
  people,
}: {
  readonly icon: typeof IconUsers;
  readonly label: string;
  readonly people: ReadonlyArray<string>;
}) {
  if (people.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="flex items-center gap-1"
            aria-label={`${label}: ${people.join(", ")}`}
          />
        }
      >
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        {people.slice(0, 3).map((person) => (
          <Avatar key={person} name={person} letters={1} className="size-4" />
        ))}
        {people.length > 3 && (
          <span className="text-xs text-muted-foreground">
            +{people.length - 3}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{`${label}: ${people.join(", ")}`}</TooltipContent>
    </Tooltip>
  );
}

export function PullRequestOverview({
  pull,
  currentBranch,
  onCheckout,
  onBack,
  className,
  style,
}: {
  readonly pull: PullRequestInfo;
  /** The branch the working copy is on, so the button can say you are on it. */
  readonly currentBranch: string | null;
  readonly onCheckout: (pull: PullRequestInfo, branch: string) => Promise<void>;
  /** Back to the list of pull requests, which this column replaced. */
  readonly onBack: () => void;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}) {
  const [checkingOut, setCheckingOut] = useState(false);
  const localBranch = localBranchForPull(pull);
  const onBranch = currentBranch === localBranch;
  const counts = countChecks(pull);
  const summary = checksSummary(pull);
  const blocked = blockedReason(pull);

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

  return (
    <section
      className={cn("flex min-h-0 flex-col overflow-hidden", className)}
      style={style}
      aria-label={`Pull request #${pull.number}`}
    >
      {/* The way back, at the top of the column that replaced the list. The
          trail at the foot of the window says the same thing, but it says it
          about wherever you are; this is here whatever the diff is showing. */}
      <div className="flex shrink-0 items-center border-b p-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <IconArrowLeft className="size-3.5 shrink-0" />
          Back to list
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <div className="flex flex-col gap-3 p-3">
          <header className="flex flex-col gap-1.5">
            <div className="flex items-start gap-1.5">
              {pull.draft ? (
                <IconGitPullRequestDraft
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-label="Draft pull request"
                />
              ) : (
                <IconGitPullRequest
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-label="Open pull request"
                />
              )}
              <h2 className="min-w-0 flex-1 text-sm font-medium text-pretty">
                {pull.title}
              </h2>
              {pull.url.length > 0 && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href={pull.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open #${pull.number} on GitHub`}
                        className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      />
                    }
                  >
                    <IconExternalLink className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>Open on GitHub</TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <a
                href={pull.url.length > 0 ? pull.url : undefined}
                target="_blank"
                rel="noreferrer"
                className="font-mono hover:text-foreground hover:underline"
              >
                #{pull.number}
              </a>
              {pull.draft && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                  Draft
                </Badge>
              )}
              {pull.author.length > 0 && (
                <span className="flex items-center gap-1">
                  <Avatar name={pull.author} letters={1} className="size-4" />
                  {pull.author}
                </span>
              )}
              {pull.updatedAt.length > 0 && (
                <span>updated {timeAgo(pull.updatedAt)}</span>
              )}
              {pull.changedFiles > 0 && (
                <span className="tabular-nums">
                  {pull.changedFiles} file{pull.changedFiles === 1 ? "" : "s"}{" "}
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{pull.additions}
                  </span>{" "}
                  <span className="text-destructive">−{pull.deletions}</span>
                </span>
              )}
            </div>
            <div className="flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground">
              <span className="truncate">{pull.headRef}</span>
              <IconArrowNarrowRight className="size-3.5 shrink-0" />
              <span className="truncate">{pull.baseRef}</span>
            </div>
          </header>

          {/* Checking the branch out is the one thing a reviewer does to a pull
              request that changes the machine they are on, so it says which
              branch it will leave them on before they press it — and, once they
              are on it, says that instead of offering to do it again. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={onBranch ? "ghost" : "outline"}
                  size="sm"
                  className="h-7 w-full justify-start gap-1.5 text-xs"
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
                <IconGitBranch className="size-3.5 shrink-0" />
              )}
              <span className="truncate font-mono">{localBranch}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">
                {onBranch ? "checked out" : checkingOut ? "…" : "check out"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {onBranch
                ? `The working copy is already on ${localBranch}.`
                : pull.fromFork
                  ? `Fetch #${pull.number} from the fork it was opened from and ` +
                    `check it out as ${localBranch}.`
                  : `Fetch ${pull.headRef} from origin and check it out. An ` +
                    "existing local branch is fast-forwarded, never reset."}
            </TooltipContent>
          </Tooltip>

          {(pull.assignees.length > 0 || pull.reviewers.length > 0) && (
            <div className="flex flex-wrap items-center gap-3">
              <People
                icon={IconUsers}
                label="Assigned to"
                people={pull.assignees}
              />
              <People
                icon={IconGitPullRequest}
                label="Review requested from"
                people={pull.reviewers}
              />
            </div>
          )}

          {pull.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pull.labels.map((label) => (
                <Badge
                  key={label.name}
                  variant="outline"
                  className="h-4 px-1.5 text-[10px]"
                  style={labelStyle(label.color)}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          )}

          {/* The blocker gets a line of prose rather than only the icon it
              shares with the picker: this is the pane you are in when you find
              out, and "why" is the next thing you would ask. */}
          {blocked !== null && (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-pretty">
              {/* The bare glyph, not `BlockedIcon`: its tooltip would say what
                  the sentence next to it already says. */}
              <IconAlertTriangleFilled className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{blocked}</span>
            </p>
          )}

          {summary !== null && (
            <div className="flex flex-col gap-1 rounded-md border p-2">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <ChecksIcon pull={pull} />
                <span>{summary}</span>
              </div>
              <ul className="flex flex-col">
                {orderedChecks.slice(0, CHECKS_SHOWN).map((check) => (
                  <li
                    key={`${check.name}-${check.url}`}
                    className="flex items-center gap-1.5 py-0.5 text-xs"
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
                        className="truncate text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {check.name}
                      </a>
                    ) : (
                      <span className="truncate text-muted-foreground">
                        {check.name}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {counts.total > CHECKS_SHOWN && (
                <a
                  href={`${pull.url}/checks`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {counts.total - CHECKS_SHOWN} more on GitHub
                </a>
              )}
            </div>
          )}

          {pull.body.trim().length > 0 && (
            <div className="border-t pt-3">
              <ChatMarkdown text={pull.body} />
            </div>
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
