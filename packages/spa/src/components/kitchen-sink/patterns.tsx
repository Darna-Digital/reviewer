import {
  IconChevronRight,
  IconGitPullRequest,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react"

import {
  Section,
  Subsection,
} from "@/components/kitchen-sink/kitchen-sink-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const STATS = [
  { label: "Files changed", value: "14" },
  { label: "Unresolved comments", value: "2" },
  { label: "Commits ahead", value: "6" },
  { label: "Checks passing", value: "18/19" },
]

/**
 * Divider and padding per position, for a grid that goes 2 columns → 4. Row
 * starts drop their left padding, row ends drop their right, and the vertical
 * rules move when the column count changes.
 */
const STAT_LAYOUT = [
  "pr-5 pb-5 lg:pb-0",
  "border-l pl-5 pb-5 lg:pr-5 lg:pb-0",
  "border-t border-foreground/10 pt-5 pr-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5",
  "border-t border-l border-foreground/10 pt-5 pl-5 lg:border-t-0 lg:pt-0",
]

const THREADS = [
  {
    title: "Address these review comments in the codebase",
    repo: "web-app",
    when: "3d",
    state: "Running",
    dot: "bg-brand-500",
  },
  {
    title: "Style injected Amazon button",
    repo: "web-app",
    when: "1mo",
    state: "Merged",
    dot: "bg-success",
  },
  {
    title: "Investigate ECS auto-scaling failures",
    repo: "bemybond",
    when: "1mo",
    state: "Waiting",
    dot: "bg-warning",
  },
]

const PULLS = [
  {
    title: "Add visual review comments support",
    author: "Rūtenis",
    branch: "task/visual-comments",
    checks: "Passing",
    tone: "text-success",
  },
  {
    title: "Gate releases behind checks",
    author: "Rūtenis",
    branch: "chore/release-gate",
    checks: "Failing",
    tone: "text-destructive",
  },
  {
    title: "Add Claude Opus 5 as the default chat model",
    author: "Rūtenis",
    branch: "feat/opus-5",
    checks: "Queued",
    tone: "text-muted-foreground",
  },
]

function Monogram({ initials }: { initials: string }) {
  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[0.625rem] font-medium text-brand-800 outline-1 -outline-offset-1 outline-black/5 dark:bg-brand-950 dark:text-brand-200 dark:outline-white/10">
      {initials}
    </div>
  )
}

export function Patterns() {
  return (
    <>
      <Section
        id="surfaces"
        title="Surfaces"
        description="Reach for the lightest separation that still works. Most groupings need nothing but space; a card is the last step, not the first."
      >
        <Subsection
          title="Space only"
          hint="Enough when the content already contrasts — a big number against a small label."
        >
          <div className="flex flex-col gap-1">
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              18/19
            </p>
            <p className="text-base text-muted-foreground sm:text-sm">
              Checks passing
            </p>
          </div>
        </Subsection>

        <Subsection
          title="Hairline"
          hint="For siblings in a shared context. Opacity-based, never a solid grey."
        >
          <dl className="grid grid-cols-2 *:border-foreground/10 lg:grid-cols-4">
            {STATS.map(({ label, value }, i) => (
              <div key={label} className={STAT_LAYOUT[i]}>
                <dt className="truncate text-base text-muted-foreground sm:text-sm">
                  {label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Subsection>

        <Subsection
          title="Well"
          hint="A recessed fill for secondary or nested content. No shadow, so it reads as set into the page."
        >
          <div className="rounded-3xl bg-muted p-5">
            <p className="text-base font-medium sm:text-sm">Worktree</p>
            <p className="mt-1 max-w-[56ch] font-mono text-sm/6 text-muted-foreground">
              ~/programming/darna-digital-organization/byconvo
            </p>
          </div>
        </Subsection>

        <Subsection
          title="Card"
          hint="Only for something independently interactive, or content of a different kind entirely."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {THREADS.slice(0, 2).map(({ title, repo, when, state, dot }) => (
              <a
                key={title}
                href="#surfaces"
                className="group flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-xs ring-1 ring-foreground/5 hover:ring-brand-300 dark:shadow-none dark:hover:ring-brand-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-base/6 font-medium text-pretty sm:text-sm/6">
                    {title}
                  </p>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground sm:text-xs">
                  <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                  {state}
                  <span aria-hidden="true">·</span>
                  {repo}
                  <span aria-hidden="true">·</span>
                  <span>{when}</span>
                </div>
              </a>
            ))}
          </div>
        </Subsection>
      </Section>

      <Section
        id="data"
        title="Data display"
        description="Lists and tables sit straight on the page. Rows are separated by a single hairline, and the row itself is the hit target."
      >
        <Subsection title="List rows">
          <ul role="list" className="divide-y divide-foreground/10">
            {THREADS.map(({ title, repo, when, state, dot }) => (
              <li key={title}>
                <a
                  href="#data"
                  className="flex items-center gap-3 py-3 hover:bg-muted/60"
                >
                  <Monogram initials={repo.slice(0, 2).toUpperCase()} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-base/6 sm:text-sm/6">{title}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground sm:text-xs">
                      <span className={`size-2 shrink-0 rounded-full ${dot}`} />
                      {state} in {repo}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm text-muted-foreground tabular-nums sm:text-xs">
                    {when}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </Subsection>

        <Subsection title="Table">
          <div className="scroll-fade-x -mx-4 -my-2 overflow-x-auto whitespace-nowrap sm:-mx-6 lg:mx-0">
            <div className="inline-block min-w-full px-4 py-2 align-middle sm:px-6 lg:px-0">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-foreground/10">
                    <th className="pr-4 pb-2 text-base font-medium whitespace-nowrap sm:text-sm">
                      Pull request
                    </th>
                    <th className="pr-4 pb-2 text-base font-medium whitespace-nowrap sm:text-sm">
                      Branch
                    </th>
                    <th className="pr-4 pb-2 text-base font-medium whitespace-nowrap sm:text-sm">
                      Author
                    </th>
                    <th className="pb-2 text-base font-medium whitespace-nowrap sm:text-sm">
                      Checks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {PULLS.map(({ title, author, branch, checks, tone }) => (
                    <tr key={branch}>
                      <td className="py-3 pr-4 text-base sm:text-sm">
                        {title}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="font-mono">
                          {branch}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-base text-muted-foreground sm:text-sm">
                        {author}
                      </td>
                      <td className={`py-3 text-base sm:text-sm ${tone}`}>
                        {checks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Subsection>
      </Section>

      <Section
        id="feedback"
        title="Feedback"
        description="Tell the user what happened and what they can do about it. Both patterns here keep their action inline rather than sending the user somewhere else."
      >
        <Subsection title="Banner">
          <div className="flex items-start gap-3 rounded-3xl bg-card p-4 shadow-lg ring-1 ring-foreground/5 dark:shadow-none">
            <div className="flex h-lh shrink-0 items-center text-base/6 sm:text-sm/6">
              <IconInfoCircle className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-base/6 font-medium sm:text-sm/6">
                A new rate limit reset is available
              </p>
              <p className="max-w-[56ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
                You were granted a reset that expires in 30 days.
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0">
              See resets
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Dismiss"
              className="shrink-0"
            >
              <IconX />
            </Button>
          </div>
        </Subsection>

        <Subsection title="Empty state">
          <div className="flex flex-col items-center gap-1 rounded-3xl border border-dashed border-foreground/15 px-6 py-14 text-center">
            <IconGitPullRequest className="size-4 shrink-0 text-muted-foreground" />
            <p className="mt-2 text-base font-medium sm:text-sm">
              No open pull requests
            </p>
            <p className="max-w-[48ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
              When you push a branch, it shows up here with its checks and
              review comments.
            </p>
            <Button size="sm" variant="outline" className="mt-4">
              Push current branch
            </Button>
          </div>
        </Subsection>
      </Section>
    </>
  )
}
