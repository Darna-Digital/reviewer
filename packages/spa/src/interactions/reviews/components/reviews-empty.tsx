/**
 * What the reviews page says when it has nothing to list.
 *
 * The two cases are different questions, so they get different answers: an
 * empty list on a project that could fill it is a waiting room, while a project
 * with no remote is one where half the list was never going to arrive and says
 * so instead of looking broken.
 */
import { IconGitPullRequest, IconPlugConnectedX } from "@tabler/icons-react";

export function NoReviews() {
  return (
    <ReviewsEmpty
      icon={IconGitPullRequest}
      title="Nothing to review"
      body="Pull and merge requests opened on this project show up here, ready to read without leaving the app."
    />
  );
}

export function NoReviewRemote() {
  return (
    <ReviewsEmpty
      icon={IconPlugConnectedX}
      title="No GitHub or GitLab remote"
      body="This project's origin is on neither GitHub nor GitLab, so nothing arrives here for review. The changes in this checkout are still read here."
    />
  );
}

function ReviewsEmpty({
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
