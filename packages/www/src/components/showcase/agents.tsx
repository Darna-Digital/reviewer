import { PaneHeader } from "#/components/app-window";
import { Sparkle, Terminal } from "#/components/icons";

const AGENTS = [
  { label: "Claude Code", hint: "claude -p", active: true },
  { label: "Codex", hint: "codex exec" },
  { label: "opencode", hint: "opencode run" },
  { label: "Cursor", hint: "cursor-agent" },
  { label: "Terminal", hint: "zsh" },
  { label: "reviewer", hint: "my-agent run {prompt}", custom: true },
];

const TRANSCRIPT = [
  {
    tone: "prompt",
    text: '$ claude -p "apply the review comments on this branch"',
  },
  {
    tone: "muted",
    text: "byconvo → 3 comments, 2 files, branch task/landing-page",
  },
  {
    tone: "plain",
    text: "Reading interactions/comments/functions/comments.functions.ts",
  },
  { tone: "plain", text: "Edit  comments.functions.ts  +6 −2" },
  { tone: "plain", text: "Edit  comments.functions.test.ts  +14 −0" },
  { tone: "run", text: "$ pnpm --filter spa test comments" },
  { tone: "ok", text: "✓ comments functions (7 tests) 41ms" },
  { tone: "muted", text: "Resolved 2 comments · 1 left for you" },
] as const;

const TONE_CLASS = {
  prompt: "text-[#7ee787]",
  run: "text-[#7ee787]",
  ok: "text-[#56d364]",
  muted: "text-neutral-500",
  plain: "text-neutral-300",
} as const;

const WORK_LOG = [
  { label: "Comments read", value: "3" },
  { label: "Files touched", value: "2" },
  { label: "Tests run", value: "7 passed" },
  { label: "Duration", value: "1m 12s" },
];

export function AgentsShowcase() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5">
        <PaneHeader actions={<span>Session · task/landing-page</span>}>
          <Terminal className="size-3.5 text-neutral-400" />
          <span className="font-medium text-neutral-800">Apply the review</span>
        </PaneHeader>
        <div className="bg-[#0d1117] p-4 font-mono text-[11px] leading-[1.9] sm:text-xs">
          {TRANSCRIPT.map((line) => (
            <div className={TONE_CLASS[line.tone]} key={line.text}>
              {line.text}
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2 text-neutral-500">
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-neutral-400" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-black/10 bg-white p-3 shadow-xl shadow-black/5">
          <p className="px-1 pb-2 text-[11px] font-medium text-neutral-500">
            New thread
          </p>
          <ul>
            {AGENTS.map((agent) => (
              <li
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${agent.active ? "bg-neutral-100" : ""}`}
                key={agent.label}
              >
                <span className="grid size-5 place-items-center rounded-[5px] bg-neutral-900 text-white">
                  {agent.custom ? (
                    <Terminal className="size-3" />
                  ) : (
                    <Sparkle className="size-3" />
                  )}
                </span>
                <span className="text-xs font-medium text-neutral-800">
                  {agent.label}
                </span>
                <span className="ml-auto font-mono text-[10px] text-neutral-400">
                  {agent.hint}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-black/10 bg-black/8 shadow-xl shadow-black/5">
          {WORK_LOG.map((entry) => (
            <div className="bg-white px-3 py-3" key={entry.label}>
              <dt className="text-[11px] text-neutral-500">{entry.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-neutral-900">
                {entry.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
