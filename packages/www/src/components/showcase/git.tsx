import { PaneHeader } from "#/components/app-window";
import { GitBranch, GitPullRequest, History } from "#/components/icons";
import { Avatar } from "#/components/showcase/avatar";

const ROW_HEIGHT = 26;

const COMMITS = [
  {
    lane: 0,
    refs: ["task/landing-page"],
    subject: "Draw the landing page from real components",
    author: "RR",
  },
  {
    lane: 0,
    refs: ["origin/master"],
    subject: "Merge pull request #27 from claude/lsp-multi-repo-support",
    author: "RR",
  },
  {
    lane: 1,
    refs: [],
    subject: "Point the language features at the root that holds the file",
    author: "CC",
  },
  {
    lane: 1,
    refs: [],
    subject: "Support project-relative language paths across repositories",
    author: "CC",
  },
  {
    lane: 0,
    refs: [],
    subject: "Add project-wide content search",
    author: "RR",
  },
  {
    lane: 0,
    refs: [],
    subject: "Remove bottom dock branches view",
    author: "RR",
  },
  {
    lane: 0,
    refs: [],
    subject: "Page the project history, once per root",
    author: "CC",
  },
];

const LANE_X = [12, 26];
const LANE_STROKE = [
  "stroke-[#8a8a8a]",
  "stroke-[#5b8def] dark:stroke-[#7ba3f5]",
];

const PULLS = [
  {
    number: 27,
    title: "Support multi-repo language features",
    state: "Open",
    comments: 3,
    author: "CC",
  },
  {
    number: 26,
    title: "Simplify the new chat composer placeholder",
    state: "Merged",
    comments: 1,
    author: "RR",
  },
  {
    number: 25,
    title: "Keep the branch menu open per root",
    state: "Draft",
    comments: 0,
    author: "CC",
  },
];

const STATE_TONE: Record<string, string> = {
  Open: "bg-[#e6f2ea] text-[#2b6b45] dark:bg-[#1a3626] dark:text-[#8ed4a6]",
  Merged: "bg-[#f0eaf9] text-[#5b3d8c] dark:bg-[#2e2547] dark:text-[#c4b0ea]",
  Draft: "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400",
};

const ROOTS = ["byconvo", "client-portal", "darna-site"];

export function GitShowcase() {
  const graphHeight = COMMITS.length * ROW_HEIGHT;
  const centre = (row: number) => row * ROW_HEIGHT + ROW_HEIGHT / 2;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
        <PaneHeader
          actions={
            <span className="flex items-center gap-1.5">
              <GitBranch className="size-3.5" />
              task/landing-page
            </span>
          }
        >
          <History className="size-3.5 text-neutral-400 dark:text-neutral-500" />
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            History
          </span>
          <span className="flex gap-1">
            {ROOTS.map((root, index) => (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${index === 0 ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950" : "text-neutral-500 ring-1 ring-black/8 ring-inset dark:text-neutral-400 dark:ring-white/10"}`}
                key={root}
              >
                {root}
              </span>
            ))}
          </span>
        </PaneHeader>

        <div className="relative">
          <svg
            className="absolute top-0 left-0"
            width={40}
            height={graphHeight}
            aria-hidden="true"
          >
            <path
              className={LANE_STROKE[0]}
              d={`M${LANE_X[0]},${centre(0)} L${LANE_X[0]},${centre(COMMITS.length - 1)}`}
              strokeWidth={1.25}
              fill="none"
            />
            <path
              className={LANE_STROKE[1]}
              d={`M${LANE_X[0]},${centre(1)} C${LANE_X[0]},${centre(1) + 13} ${LANE_X[1]},${centre(2) - 13} ${LANE_X[1]},${centre(2)} L${LANE_X[1]},${centre(3)} C${LANE_X[1]},${centre(3) + 13} ${LANE_X[0]},${centre(4) - 13} ${LANE_X[0]},${centre(4)}`}
              strokeWidth={1.25}
              fill="none"
            />
            {COMMITS.map((commit, row) => (
              <circle
                className={`fill-white dark:fill-neutral-900 ${LANE_STROKE[commit.lane]}`}
                cx={LANE_X[commit.lane]}
                cy={centre(row)}
                key={commit.subject}
                r={3.25}
                strokeWidth={1.5}
              />
            ))}
          </svg>

          <ul className="pl-10">
            {COMMITS.map((commit) => (
              <li
                className="flex items-center gap-2 pr-3 text-[11px]"
                key={commit.subject}
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                {commit.refs.map((ref) => (
                  <span
                    className="hidden shrink-0 rounded-sm bg-neutral-100 px-1 font-mono text-[10px] text-neutral-500 sm:inline dark:bg-white/10 dark:text-neutral-400"
                    key={ref}
                  >
                    {ref}
                  </span>
                ))}
                <span className="truncate text-neutral-800 dark:text-neutral-200">
                  {commit.subject}
                </span>
                <Avatar
                  className="ml-auto size-4 text-[8px]"
                  initials={commit.author}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
        <PaneHeader actions={<span>Darna-Digital/byconvo</span>}>
          <GitPullRequest className="size-3.5 text-neutral-400 dark:text-neutral-500" />
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Pull requests
          </span>
        </PaneHeader>
        <ul className="divide-y divide-black/6 dark:divide-white/8">
          {PULLS.map((pull) => (
            <li
              className="flex items-start gap-2.5 px-3 py-2.5"
              key={pull.number}
            >
              <Avatar
                className="mt-0.5 size-5 text-[9px]"
                initials={pull.author}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs leading-snug text-neutral-800 dark:text-neutral-200">
                  {pull.title}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                    #{pull.number}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATE_TONE[pull.state]}`}
                  >
                    {pull.state}
                  </span>
                  {pull.comments > 0 ? (
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {pull.comments} review comments
                    </span>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-black/8 bg-[#fff8f5] px-3 py-2.5 text-[11px] text-[#9a4a25] dark:border-white/8 dark:bg-[#43261a]/50 dark:text-[#f0b088]">
          2 files conflict with master — resolve them in the diff, then continue
          the merge.
        </div>
      </div>
    </div>
  );
}
