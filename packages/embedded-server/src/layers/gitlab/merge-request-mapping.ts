/**
 * What GitLab says about a merge request, read into `PullRequestInfo` — and
 * what it says about the notes on one, read into `ReviewComment`.
 *
 * A merge request and a pull request are the same object under two names, so
 * the app holds one shape for both and the translation happens here, at the
 * edge, as pure functions: deciding that a canceled pipeline is not a failing
 * one, or that a note with no position is a reply rather than a line comment,
 * is the part worth testing, and it should not need a network to do it.
 *
 * Two ways of asking arrive here for the same thing. `/merge_requests` is the
 * REST listing every install has, but it carries no pipeline and no line
 * counts — a reviewer cannot tell from it whether CI passed. GraphQL carries
 * all of it for every open merge request in one round trip, and unlike
 * GitHub's it answers unauthenticated callers on a public project. So the
 * provider asks GraphQL first and falls back to the listing, and both readings
 * land here as pure functions.
 *
 * Two GitLab spellings need saying out loud. A merge request is addressed by
 * its `iid` — the number people see, unique within the project — and never by
 * its global `id`. And a comment lives in a *discussion*: the first note in
 * one carries the diff position, every later note in it is a reply to that
 * position, and replying means posting to the discussion rather than to a
 * note. That is why a comment's id here holds both halves.
 */
import type { ReviewComment } from "@byconvo/core/comments";
import {
  unenrichedPull,
  type CheckState,
  type MergeableState,
  type PullRequestCheck,
  type PullRequestInfo,
  type PullRequestLabel,
} from "@byconvo/core/ports/git-provider";
import type { FileDiff } from "../reviews/unified-diff.ts";

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const records = (value: unknown): ReadonlyArray<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        const parsed = record(entry);
        return parsed === null ? [] : [parsed];
      })
    : [];

const usernames = (value: unknown): ReadonlyArray<string> =>
  records(value)
    .map((user) => str(user["username"]))
    .filter((login) => login.length > 0);

/**
 * A pipeline's status, in the four words the review UI reads.
 *
 * `manual`, `scheduled` and `skipped` are deliberately neutral: nothing is
 * wrong, and nothing has passed either. A `canceled` pipeline is neutral for
 * the same reason a cancelled GitHub check run is — somebody stopped it, which
 * is not the same as it going red.
 */
export const pipelineState = (status: unknown): CheckState => {
  switch (str(status).toLowerCase()) {
    case "success":
      return "success";
    case "failed":
      return "failure";
    case "canceled":
    case "cancelled":
    case "skipped":
    case "manual":
    case "scheduled":
      return "neutral";
    default:
      return "pending";
  }
};

/**
 * Whether the merge request can land. GitLab answers `merge_status` lazily —
 * `unchecked` while it works it out — which is exactly what "unknown" is for.
 * A merge request it has already found conflicts on says so outright.
 */
export const mergeableFrom = (mr: Record<string, unknown>): MergeableState => {
  if (mr["has_conflicts"] === true) return "conflicting";
  switch (str(mr["merge_status"]).toLowerCase()) {
    case "can_be_merged":
      return "mergeable";
    case "cannot_be_merged":
      return "conflicting";
    default:
      return "unknown";
  }
};

/**
 * The head pipeline as one check row.
 *
 * GitLab has no per-check list on a merge request the way GitHub's rollup does
 * — it has a pipeline, which is one verdict over many jobs — so it is shown as
 * the one thing it is rather than expanded into jobs nobody asked for.
 */
export const checksFromPipeline = (
  pipeline: unknown
): ReadonlyArray<PullRequestCheck> => {
  const head = record(pipeline);
  if (head === null) return [];
  const status = str(head["status"]);
  if (status.length === 0) return [];
  const name = str(head["name"], "");
  return [
    {
      name: name.length > 0 ? name : `Pipeline #${num(head["id"])}`,
      state: pipelineState(status),
      url: str(head["web_url"]),
    },
  ];
};

/**
 * A merge request's labels. GitLab sends bare names unless the caller asks for
 * details, and the details spell the colour `#RRGGBB` where the app (and
 * GitHub) spell it without the hash.
 */
export const labelsFrom = (value: unknown): ReadonlyArray<PullRequestLabel> => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((label): Array<PullRequestLabel> => {
    if (typeof label === "string")
      return label.length > 0 ? [{ name: label, color: "" }] : [];
    const detail = record(label);
    if (detail === null) return [];
    const name = str(detail["name"]);
    return name.length === 0
      ? []
      : [{ name, color: str(detail["color"]).replace(/^#/, "") }];
  });
};

/** GitLab counts changed files as `"5"`, or `"5+"` when it stopped counting. */
const changedFiles = (value: unknown): number => {
  if (typeof value === "number") return num(value);
  const parsed = Number.parseInt(str(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * One `/merge_requests` entry. The listing carries everything the review pane
 * decides by except the line counts, which GitLab only knows once the diff has
 * been fetched — so they stay at the unenriched zero rather than being guessed.
 */
export const mergeRequestFrom = (
  mr: Record<string, unknown>
): PullRequestInfo => ({
  ...unenrichedPull,
  number: num(mr["iid"]),
  title: str(mr["title"]),
  author: str(record(mr["author"])?.["username"]),
  baseRef: str(mr["target_branch"]),
  headRef: str(mr["source_branch"]),
  headSha: str(mr["sha"]),
  url: str(mr["web_url"]),
  updatedAt: str(mr["updated_at"]),
  createdAt: str(mr["created_at"]),
  body: str(mr["description"]),
  draft: mr["draft"] === true || mr["work_in_progress"] === true,
  fromFork:
    num(mr["source_project_id"]) !== num(mr["target_project_id"]) &&
    num(mr["source_project_id"]) > 0,
  mergeable: mergeableFrom(mr),
  checks: checksFromPipeline(mr["head_pipeline"] ?? mr["pipeline"]),
  assignees: usernames(mr["assignees"]),
  reviewers: usernames(mr["reviewers"]),
  labels: labelsFrom(mr["labels"]),
  changedFiles: changedFiles(mr["changes_count"]),
});

/** The whole listing → the open merge requests it holds. */
export const mergeRequestsFrom = (
  data: unknown
): ReadonlyArray<PullRequestInfo> =>
  records(data)
    .map(mergeRequestFrom)
    .filter((mr) => mr.number > 0);

/**
 * A comment's id: the discussion it hangs in and the note itself, because
 * GitLab needs the first to reply and the second to delete. Read back by
 * `parseCommentId`, which is the only thing that takes them apart again.
 */
export const commentId = (discussionId: string, noteId: number): string =>
  `gl-${discussionId}-${noteId}`;

export interface GitLabCommentRef {
  readonly discussionId: string;
  readonly noteId: number;
}

/**
 * `<discussion>-<note>` — the halves of a GitLab comment id, as handed back by
 * `remoteCommentId` with the `gl-` prefix already off. A discussion id is hex
 * and a note id is digits, so the last dash is the seam.
 */
export const parseCommentId = (id: string): GitLabCommentRef | null => {
  const match = /^(.+)-(\d+)$/.exec(id);
  const discussionId = match?.[1];
  const noteId = Number(match?.[2]);
  return discussionId === undefined || !Number.isInteger(noteId)
    ? null
    : { discussionId, noteId };
};

interface NotePosition {
  readonly filePath: string;
  readonly side: ReviewComment["side"];
  readonly lineNumber: number;
}

interface RawPosition {
  readonly newLine: unknown;
  readonly oldLine: unknown;
  readonly newPath: unknown;
  readonly oldPath: unknown;
}

/**
 * Where a note hangs on the diff.
 *
 * GitLab reports both sides of the change and the app draws one: a note with a
 * new line is on the code as it now stands, and one with only an old line is on
 * a line the change removed. A note on a file rather than a line (an image, or
 * a comment on the whole file) has neither and is not a line comment.
 */
const anchorOf = (position: RawPosition): NotePosition | null => {
  if (typeof position.newLine === "number") {
    const filePath = str(position.newPath, str(position.oldPath));
    return filePath.length === 0
      ? null
      : { filePath, side: "additions", lineNumber: position.newLine };
  }
  if (typeof position.oldLine === "number") {
    const filePath = str(position.oldPath, str(position.newPath));
    return filePath.length === 0
      ? null
      : { filePath, side: "deletions", lineNumber: position.oldLine };
  }
  return null;
};

/** A REST note's position — GitLab spells these with underscores there. */
export const notePosition = (
  note: Record<string, unknown>
): NotePosition | null => {
  const position = record(note["position"]);
  return position === null
    ? null
    : anchorOf({
        newLine: position["new_line"],
        oldLine: position["old_line"],
        newPath: position["new_path"],
        oldPath: position["old_path"],
      });
};

/** The same, from GraphQL, which spells them in camel case. */
const graphqlNotePosition = (
  note: Record<string, unknown>
): NotePosition | null => {
  const position = record(note["position"]);
  return position === null
    ? null
    : anchorOf({
        newLine: position["newLine"],
        oldLine: position["oldLine"],
        newPath: position["newPath"],
        oldPath: position["oldPath"],
      });
};

/**
 * Every line comment on a merge request, discussions flattened into the one
 * list the diff view reads.
 *
 * The position belongs to the discussion, not to each note: only the note that
 * opened it carries one, and its replies are shown on the same line — which is
 * what makes a GitLab thread read as a thread here. System notes (GitLab
 * narrating its own state changes) are not comments and are dropped.
 */
export const commentsFromDiscussions = (
  data: unknown,
  mergeRequestIid: number
): ReadonlyArray<ReviewComment> =>
  records(data).flatMap((discussion): Array<ReviewComment> => {
    const discussionId = str(discussion["id"]);
    const notes = records(discussion["notes"]).filter(
      (note) => note["system"] !== true
    );
    const anchor = notes.map(notePosition).find((at) => at !== null);
    if (discussionId.length === 0 || anchor === undefined) return [];
    return notes.map((note) => ({
      id: commentId(discussionId, num(note["id"])),
      filePath: anchor.filePath,
      side: anchor.side,
      lineNumber: anchor.lineNumber,
      body: str(note["body"]),
      author: str(record(note["author"])?.["username"]),
      createdAt: str(note["created_at"]),
      target: `pr-${mergeRequestIid}`,
      source: "gitlab",
    }));
  });

/** One note read back as the comment it just became. */
export const commentFromNote = (
  note: unknown,
  at: {
    readonly discussionId: string;
    readonly filePath: string;
    readonly side: ReviewComment["side"];
    readonly lineNumber: number;
    readonly mergeRequestIid: number;
    readonly body: string;
  }
): ReviewComment => {
  const parsed = record(note) ?? {};
  return {
    id: commentId(at.discussionId, num(parsed["id"])),
    filePath: at.filePath,
    side: at.side,
    lineNumber: at.lineNumber,
    body: str(parsed["body"], at.body),
    author: str(record(parsed["author"])?.["username"]),
    createdAt: str(parsed["created_at"], new Date().toISOString()),
    target: `pr-${at.mergeRequestIid}`,
    source: "gitlab",
  };
};

/**
 * The discussion a freshly created one answers as — GitLab replies to a POST
 * with the whole discussion, whose single note is the comment just made.
 */
export const createdDiscussion = (
  data: unknown
): { readonly discussionId: string; readonly note: unknown } | null => {
  const discussion = record(data);
  const discussionId = str(discussion?.["id"]);
  const note = records(discussion?.["notes"])[0];
  return discussionId.length === 0 || note === undefined
    ? null
    : { discussionId, note };
};

/**
 * A merge request's changed files, as the diff builder wants them. GitLab
 * spells the two paths separately and flags what happened to the file, so a
 * rename is the case where the paths differ and neither flag is set.
 */
export const parseMergeRequestDiffs = (
  data: unknown
): ReadonlyArray<FileDiff> => {
  // `/diffs` answers with the array itself; the older `/changes` wraps it.
  const entries = Array.isArray(data)
    ? records(data)
    : records(record(data)?.["changes"]);
  return entries.flatMap((entry): Array<FileDiff> => {
    const path = str(entry["new_path"], str(entry["old_path"]));
    if (path.length === 0) return [];
    const previousPath = str(entry["old_path"], path);
    const status: FileDiff["status"] =
      entry["new_file"] === true
        ? "added"
        : entry["deleted_file"] === true
          ? "removed"
          : entry["renamed_file"] === true || previousPath !== path
            ? "renamed"
            : "modified";
    const patch = str(entry["diff"]);
    return [
      {
        previousPath,
        path,
        status,
        // GitLab sends "" for a binary file, which is not a patch of no lines.
        ...(patch.length === 0 ? {} : { patch: patch.replace(/\n$/, "") }),
      },
    ];
  });
};

/** How many open merge requests one listing asks for, either way of asking. */
export const MERGE_REQUESTS_PER_PAGE = 50;

const nodes = (value: unknown): ReadonlyArray<Record<string, unknown>> =>
  records(record(value)?.["nodes"]);

const graphqlUsernames = (value: unknown): ReadonlyArray<string> =>
  nodes(value)
    .map((user) => str(user["username"]))
    .filter((login) => login.length > 0);

/**
 * The head pipeline, from GraphQL. Its `path` is relative to the instance —
 * `/group/project/-/pipelines/1` — so the instance's own URL is put back in
 * front of it; a check the reader cannot click through to is half a check.
 */
const graphqlChecks = (
  pipeline: unknown,
  webUrl: string
): ReadonlyArray<PullRequestCheck> => {
  const head = record(pipeline);
  const status = str(head?.["status"]);
  if (head === null || status.length === 0) return [];
  const path = str(head["path"]);
  return [
    {
      name: str(head["name"]) || "Pipeline",
      state: pipelineState(status),
      url: path.length === 0 ? "" : `${webUrl}${path}`,
    },
  ];
};

/**
 * One `project.mergeRequests.nodes[]` entry.
 *
 * GraphQL spells several things differently from REST and answers the two REST
 * cannot: how many lines the change adds and removes, and what its pipeline
 * did. `iid` arrives as a string here, and every id is a global `gid://`
 * URI — which is why the numbers are read through `Number` rather than trusted.
 */
export const mergeRequestFromGraphql = (
  node: Record<string, unknown>,
  webUrl: string
): PullRequestInfo => {
  const stats = record(node["diffStatsSummary"]);
  const sourceProject = Number(node["sourceProjectId"]);
  const targetProject = Number(node["targetProjectId"]);
  return {
    ...unenrichedPull,
    number: Number(node["iid"]) || 0,
    title: str(node["title"]),
    author: str(record(node["author"])?.["username"]),
    baseRef: str(node["targetBranch"]),
    headRef: str(node["sourceBranch"]),
    headSha: str(node["diffHeadSha"]),
    url: str(node["webUrl"]),
    updatedAt: str(node["updatedAt"]),
    createdAt: str(node["createdAt"]),
    body: str(node["description"]),
    draft: node["draft"] === true,
    fromFork:
      Number.isFinite(sourceProject) &&
      Number.isFinite(targetProject) &&
      sourceProject !== targetProject,
    mergeable:
      node["conflicts"] === true
        ? "conflicting"
        : mergeableFrom({ merge_status: str(node["mergeStatusEnum"]) }),
    checks: graphqlChecks(node["headPipeline"], webUrl),
    assignees: graphqlUsernames(node["assignees"]),
    reviewers: graphqlUsernames(node["reviewers"]),
    // GraphQL calls a label's text its title, and keeps the leading hash.
    labels: nodes(node["labels"]).map((label) => ({
      name: str(label["title"]),
      color: str(label["color"]).replace(/^#/, ""),
    })),
    additions: num(stats?.["additions"]),
    deletions: num(stats?.["deletions"]),
    changedFiles: num(stats?.["fileCount"]),
  };
};

/** The whole GraphQL answer → the open merge requests it holds. */
export const mergeRequestsFromGraphql = (
  data: unknown,
  webUrl: string
): ReadonlyArray<PullRequestInfo> =>
  nodes(record(record(data)?.["project"])?.["mergeRequests"])
    .map((node) => mergeRequestFromGraphql(node, webUrl))
    .filter((mr) => mr.number > 0);

export const MERGE_REQUESTS_QUERY = `
query MergeRequests($path: ID!, $first: Int!) {
  project(fullPath: $path) {
    mergeRequests(state: opened, first: $first, sort: UPDATED_DESC) {
      nodes {
        iid
        title
        description
        webUrl
        draft
        conflicts
        createdAt
        updatedAt
        sourceBranch
        targetBranch
        diffHeadSha
        mergeStatusEnum
        sourceProjectId
        targetProjectId
        author { username }
        assignees(first: 10) { nodes { username } }
        reviewers(first: 10) { nodes { username } }
        labels(first: 10) { nodes { title color } }
        diffStatsSummary { additions deletions fileCount }
        headPipeline { status path }
      }
    }
  }
}`;

/**
 * The id at the end of a GraphQL global id — `gid://gitlab/Note/42` is note
 * 42. Held apart so a comment's id is the same string whichever way it was
 * read, which is what lets a reply written after a GraphQL read reach the
 * discussion over REST.
 */
export const gidId = (value: unknown): string =>
  str(value).split("/").at(-1) ?? "";

/**
 * The discussions from GraphQL, read as the same comments the REST reading
 * produces — same ids, same anchors, same order.
 */
export const commentsFromGraphqlDiscussions = (
  data: unknown,
  mergeRequestIid: number
): ReadonlyArray<ReviewComment> =>
  nodes(
    record(record(record(data)?.["project"])?.["mergeRequest"])?.["discussions"]
  ).flatMap((discussion): Array<ReviewComment> => {
    const discussionId = gidId(discussion["id"]);
    const notes = nodes(discussion["notes"]).filter(
      (note) => note["system"] !== true
    );
    const anchor = notes.map(graphqlNotePosition).find((at) => at !== null);
    if (discussionId.length === 0 || anchor === undefined) return [];
    return notes.map((note) => ({
      id: commentId(discussionId, Number(gidId(note["id"])) || 0),
      filePath: anchor.filePath,
      side: anchor.side,
      lineNumber: anchor.lineNumber,
      body: str(note["body"]),
      author: str(record(note["author"])?.["username"]),
      createdAt: str(note["createdAt"]),
      target: `pr-${mergeRequestIid}`,
      source: "gitlab",
    }));
  });

/** How many discussions one read asks for. */
export const DISCUSSIONS_PER_QUERY = 100;

export const DISCUSSIONS_QUERY = `
query MergeRequestDiscussions($path: ID!, $iid: String!, $first: Int!) {
  project(fullPath: $path) {
    mergeRequest(iid: $iid) {
      discussions(first: $first) {
        nodes {
          id
          notes(first: 50) {
            nodes {
              id
              body
              system
              createdAt
              author { username }
              position { newLine oldLine newPath oldPath }
            }
          }
        }
      }
    }
  }
}`;
