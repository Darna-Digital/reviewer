import { PaneHeader } from "#/components/app-window";
import { Cursor, Globe, Play, Stop } from "#/components/icons";
import { Avatar } from "#/components/showcase/avatar";
import { cn } from "#/lib/utils";

const SERVICES = [
  { name: "web", command: "pnpm --filter www dev", running: true },
  { name: "api", command: "pnpm --filter embedded-server dev", running: true },
  { name: "types", command: "pnpm gen:api --watch", running: false },
];

const LOG = [
  { tone: "muted", text: "web    VITE v8.0.0  ready in 412 ms" },
  { tone: "plain", text: "web    ➜  http://localhost:3000" },
  { tone: "muted", text: "api    listening on 41811" },
  { tone: "ok", text: "web    hmr update /src/routes/index.tsx" },
] as const;

const LOG_TONE = {
  muted: "text-neutral-500",
  plain: "text-neutral-300",
  ok: "text-[#56d364]",
} as const;

export function LocalDevShowcase() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
      <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
        <PaneHeader actions={<span>Start all</span>}>
          <Play className="size-3.5 text-neutral-400 dark:text-neutral-500" />
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Services
          </span>
        </PaneHeader>
        <ul className="divide-y divide-black/6 dark:divide-white/8">
          {SERVICES.map((service) => (
            <li
              className="flex items-center gap-2.5 px-3 py-2"
              key={service.name}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  service.running
                    ? "bg-[#2b6b45] dark:bg-[#3fb950]"
                    : "bg-neutral-300 dark:bg-neutral-600"
                )}
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  {service.name}
                </span>
                <span className="block truncate font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                  {service.command}
                </span>
              </span>
              <span className="ml-auto grid size-6 shrink-0 place-items-center rounded-md text-neutral-400 ring-1 ring-black/8 ring-inset dark:ring-white/10">
                {service.running ? (
                  <Stop className="size-3" />
                ) : (
                  <Play className="size-3" />
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex-1 bg-[#0d1117] p-3 font-mono text-[10px] leading-[1.9] sm:text-[11px]">
          {LOG.map((line) => (
            <div className={LOG_TONE[line.tone]} key={line.text}>
              {line.text}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5 dark:border-white/10 dark:bg-neutral-900 dark:shadow-none">
        <div className="flex items-center gap-2 border-b border-black/8 bg-neutral-50/70 px-3 py-2 dark:border-white/8 dark:bg-white/3">
          <Globe className="size-3.5 text-neutral-400 dark:text-neutral-500" />
          <span className="flex-1 truncate rounded-md bg-white px-2 py-1 font-mono text-[10px] text-neutral-500 ring-1 ring-black/8 ring-inset dark:bg-white/5 dark:text-neutral-400 dark:ring-white/10">
            localhost:3000/modes/code/review
          </span>
          <span className="flex items-center gap-1 rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white dark:bg-white dark:text-neutral-950">
            <Cursor className="size-3" />
            Pick
          </span>
        </div>

        <div className="relative bg-neutral-50 p-4 dark:bg-neutral-950">
          <div className="rounded-lg border border-black/8 bg-white p-4 shadow-sm dark:border-white/8 dark:bg-neutral-900 dark:shadow-none">
            <div className="h-2 w-24 rounded-full bg-neutral-200 dark:bg-white/20" />
            <div className="mt-3 h-2 w-full rounded-full bg-neutral-100 dark:bg-white/8" />
            <div className="mt-2 h-2 w-4/5 rounded-full bg-neutral-100 dark:bg-white/8" />
            <div className="relative mt-4 inline-flex rounded-md outline-2 outline-offset-2 outline-[#3b82f6]">
              <span className="rounded-md bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-white dark:bg-white dark:text-neutral-950">
                Submit review
              </span>
              <span className="absolute -top-2 -left-2 grid size-4 place-items-center rounded-full bg-[#3b82f6] text-[9px] font-semibold text-white">
                1
              </span>
            </div>
            <div className="mt-4 h-2 w-1/2 rounded-full bg-neutral-100 dark:bg-white/8" />
          </div>

          <div className="mt-3 max-w-sm rounded-lg border border-black/8 bg-white p-3 shadow-md dark:border-white/10 dark:bg-neutral-800 dark:shadow-none">
            <div className="flex items-center gap-2">
              <Avatar initials="RR" />
              <span className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
                Visual comment
              </span>
              <span className="ml-auto font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                button.submit-review
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="h-9 w-14 shrink-0 rounded border border-black/8 bg-neutral-100 dark:border-white/10 dark:bg-white/8" />
              <p className="text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                This stays enabled while the request is in flight — double
                submits land two reviews.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
