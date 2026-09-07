import { AppWindow, PaneHeader } from "#/components/app-window";
import { CodeLines, diffLines } from "#/components/code";
import {
  Folders,
  GitCommit,
  GitPullRequest,
  History,
  Play,
  Terminal,
} from "#/components/icons";
import { Avatar } from "#/components/showcase/avatar";

const RAIL_TOP = [
  { icon: Folders, label: "Browse the project" },
  { icon: GitCommit, label: "Local changes", active: true },
  { icon: GitPullRequest, label: "Pull requests" },
];

const RAIL_BOTTOM = [
  { icon: History, label: "History" },
  { icon: Play, label: "Services" },
  { icon: Terminal, label: "Terminal sessions" },
];

const TREE = [
  { depth: 0, name: "packages / spa", kind: "dir" },
  { depth: 1, name: "interactions", kind: "dir" },
  { depth: 2, name: "local-dev", kind: "dir" },
  { depth: 3, name: "local-dev.functions.ts", kind: "file", status: "M" },
  { depth: 3, name: "local-dev.interfaces.ts", kind: "file", status: "M" },
  { depth: 2, name: "comments", kind: "dir" },
  { depth: 3, name: "comment-thread.tsx", kind: "file", status: "U" },
  { depth: 1, name: "components / layout", kind: "dir" },
  { depth: 2, name: "mode-rail.tsx", kind: "file", status: "M" },
] as const;

const STATUS_TONE: Record<string, string> = {
  M: "text-[#9a6700] dark:text-[#e3b341]",
  U: "text-[#1a7f37] dark:text-[#3fb950]",
  D: "text-[#cf222e] dark:text-[#f85149]",
};

const PATCH = [
  " export function createLocalDevFunctions(",
  "   deps: LocalDevDependencies",
  " ): LocalDevFunctions {",
  "   return {",
  "     async create(name, command) {",
  "-      const trimmed = command.trim();",
  "-      if (!trimmed) return null;",
  "+      const trimmed = command.trim();",
  "+      if (trimmed.length === 0) return null;",
  "       return deps.sideEffects.create({",
  "         name: name.trim() || trimmed,",
  "         command: trimmed,",
  "       });",
  "     },",
  "",
  "     async start(id) {",
  "       const service = await deps.sideEffects.read(id);",
  "       if (!service) return null;",
  '-      if (service.status === "running") return service;',
  '+      if (service.status !== "stopped") return service;',
  "       return deps.sideEffects.spawn(service);",
  "     },",
  "",
  "     async stopAll() {",
  "       const running = await deps.sideEffects.list();",
  "       return Promise.all(running.map((s) => this.stop(s.id)));",
  "     },",
  "   };",
  " }",
].join("\n");

const HISTORY = [
  {
    refs: ["task/landing-page"],
    subject: "Draw the landing page from real components",
    author: "Rūtenis Raila",
  },
  {
    refs: ["origin/master"],
    subject: "Support project-relative language paths across repositories",
    author: "Rūtenis Raila",
  },
  {
    refs: [],
    subject: "Point the language features at the root that holds the file",
    author: "Claude",
  },
  {
    refs: [],
    subject:
      "Page the project history, and start the branch menu once per root",
    author: "Claude",
  },
];

export function HeroApp() {
  return (
    <AppWindow>
      <div className="flex">
        <div className="hidden w-10 shrink-0 flex-col items-center justify-between border-r border-black/8 bg-neutral-50/70 py-2 sm:flex dark:border-white/8 dark:bg-white/3">
          <div className="flex flex-col gap-1">
            {RAIL_TOP.map(({ icon: Glyph, label, active }) => (
              <span
                aria-label={label}
                className={`grid size-7 place-items-center rounded-md ${active ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950" : "text-neutral-400 dark:text-neutral-500"}`}
                key={label}
              >
                <Glyph className="size-4" />
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {RAIL_BOTTOM.map(({ icon: Glyph, label }) => (
              <span
                aria-label={label}
                className="grid size-7 place-items-center rounded-md text-neutral-400 dark:text-neutral-500"
                key={label}
              >
                <Glyph className="size-4" />
              </span>
            ))}
          </div>
        </div>

        <div className="hidden w-56 shrink-0 flex-col border-r border-black/8 lg:flex dark:border-white/8">
          <div className="flex-1 py-2">
            {TREE.map((entry) => (
              <div
                className="flex items-center gap-1.5 px-3 py-[3px] text-[11px]"
                key={entry.name}
                style={{ paddingLeft: `${12 + entry.depth * 12}px` }}
              >
                <span
                  className={
                    entry.kind === "dir"
                      ? "truncate text-neutral-500"
                      : "truncate text-neutral-800 dark:text-neutral-200"
                  }
                >
                  {entry.name}
                </span>
                {"status" in entry ? (
                  <span
                    className={`ml-auto font-mono text-[10px] ${STATUS_TONE[entry.status]}`}
                  >
                    {entry.status}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="border-t border-black/8 p-3 dark:border-white/8">
            <div className="h-16 rounded-md border border-black/10 bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-400 dark:border-white/10 dark:bg-white/4 dark:text-neutral-500">
              Commit message…
            </div>
            <div className="mt-2 flex gap-2">
              <span className="rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white dark:bg-white dark:text-neutral-950">
                Commit
              </span>
              <span className="rounded-md px-2.5 py-1 text-[11px] text-neutral-500">
                Commit &amp; push
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <PaneHeader
            actions={
              <>
                <span className="font-mono text-[#cf222e] dark:text-[#f85149]">
                  −2
                </span>
                <span className="font-mono text-[#1a7f37] dark:text-[#3fb950]">
                  +2
                </span>
                <span>Full file</span>
                <span>History</span>
                <span>Edit</span>
              </>
            }
          >
            <GitCommit className="size-3.5 text-neutral-400 dark:text-neutral-500" />
            <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
              packages/spa/src/interactions/local-dev/functions/local-dev.functions.ts
            </span>
          </PaneHeader>

          <CodeLines diff lines={diffLines(PATCH, 12)} />

          <div className="my-2 mr-3 ml-12 max-w-100 rounded-md border border-black/8 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-800 dark:shadow-none">
            <div className="flex items-center gap-2">
              <Avatar initials="RR" />
              <span className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
                Rūtenis Raila
              </span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                2m ago
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300">
              Blank-check belongs in the function, not the adapter — keep the
              rule where the test can reach it.
            </p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-400 dark:text-neutral-500">
              <span>Add reply…</span>
              <span>Resolve</span>
            </div>
          </div>

          <div className="border-t border-black/8 dark:border-white/8">
            <PaneHeader>
              <History className="size-3.5 text-neutral-400 dark:text-neutral-500" />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                History
              </span>
              <span className="text-neutral-400 dark:text-neutral-500">
                Services
              </span>
              <span className="text-neutral-400 dark:text-neutral-500">
                Terminal sessions
              </span>
            </PaneHeader>
            <div className="py-1">
              {HISTORY.map((commit) => (
                <div
                  className="flex items-center gap-2 px-3 py-[3px] text-[11px]"
                  key={commit.subject}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
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
                  <span className="ml-auto hidden shrink-0 text-neutral-400 sm:inline dark:text-neutral-500">
                    {commit.author}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}
