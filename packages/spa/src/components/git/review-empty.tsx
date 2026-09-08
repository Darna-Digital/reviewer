/**
 * What the centre of the window says when review mode has nothing to review.
 *
 * It used to say `EmptyPane` — the command menu, the file finder, the ways into a
 * diff — under a line asking you to pick a pull request from the sidebar, while
 * the sidebar beside it said there were none to pick. Two panes disagreeing, and
 * the wrong one of them was the big one: none of those gestures is how a pull
 * request arrives, so the pane read as the project browser having been left open
 * on the wrong page.
 */
import { IconGitPullRequest, IconPlugConnectedX } from "@tabler/icons-react";

/** No open pull requests, on a project that would have them. */
export function NoPullRequests() {
  return (
    <ReviewEmpty
      icon={IconGitPullRequest}
      title="No open merge requests"
      body="When a branch is pushed and opened for review, it shows up in the sidebar with its files and comments."
    />
  );
}

/**
 * Nowhere for them to come from. Reachable by a window tab left on review while
 * another project was opened, so it explains itself rather than showing the
 * emptiness of a list that was never going to fill.
 */
export function NoReviewRemote() {
  return (
    <ReviewEmpty
      icon={IconPlugConnectedX}
      title="No GitHub remote"
      body="This project is not on GitHub, so there are no merge requests to read here."
    />
  );
}

function ReviewEmpty({
  icon: Icon,
  title,
  body,
}: {
  readonly icon: typeof IconGitPullRequest;
  readonly title: string;
  readonly body: string;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex flex-col items-center gap-1 rounded-3xl border border-dashed border-foreground/15 px-6 py-14 text-center">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">{title}</p>
        <p className="max-w-[48ch] text-sm/6 text-pretty text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}
