/**
 * A turn's work log: one row per tool call or thinking block, each expandable
 * to its arguments and output. Shape borrowed from
 * fluidfunctionalism.com/docs/thinking-steps.
 */
import {
  IconAlertCircle,
  IconBrain,
  IconCheck,
  IconChevronRight,
  IconFileText,
  IconListCheck,
  IconPencil,
  IconSearch,
  IconSubtask,
  IconTerminal2,
  IconTool,
  IconWorld,
} from "@tabler/icons-react"
import { useState } from "react"
import { LoadingCursor } from "@/components/ui/loading-cursor"
import { cn } from "@/lib/utils"
import { elapsedMs, type WorkStep } from "../functions/work-log.functions"

const TOOL_ICONS: ReadonlyArray<[RegExp, typeof IconTool]> = [
  [/^bash|^command|shell|terminal/i, IconTerminal2],
  [/^read|^notebookread|^cat/i, IconFileText],
  [/^write|^edit|^multiedit|^notebookedit|file_?change|edited/i, IconPencil],
  [/^grep|^glob|^search|^ls/i, IconSearch],
  [/^web|^fetch|^url/i, IconWorld],
  [/^todo/i, IconListCheck],
  [/^task|^agent|^mcp/i, IconSubtask],
]

const stepIcon = (step: WorkStep) => {
  if (step.thinking) return IconBrain
  const match = TOOL_ICONS.find(([pattern]) => pattern.test(step.label))
  return match?.[1] ?? IconTool
}

const formatDuration = (ms: number): string =>
  ms < 1000
    ? `${ms}ms`
    : ms < 60_000
      ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
      : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`

function StatusIcon({ status }: { status: WorkStep["status"] }) {
  if (status === "failed") {
    return <IconAlertCircle className="size-3.5 shrink-0 text-destructive" />
  }
  if (status === "done") {
    return <IconCheck className="size-3.5 shrink-0 text-muted-foreground/70" />
  }
  return (
    // Boxed to the width of the done/failed icons so the rows stay aligned.
    <span className="flex size-3.5 shrink-0 items-center justify-center">
      <LoadingCursor label="Running" />
    </span>
  )
}

function Payload({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </span>
      <pre className="overflow-hidden rounded-md bg-muted px-2.5 py-2 text-[11px] leading-relaxed break-words whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  )
}

function WorkStepRow({ step, last }: { step: WorkStep; last: boolean }) {
  const [open, setOpen] = useState(false)
  const Icon = stepIcon(step)
  const expandable = step.input !== null || step.output !== null
  const tail = step.detail

  return (
    <div className="flex gap-2">
      <div className="flex w-3.5 shrink-0 flex-col items-center">
        <Icon
          className={cn(
            "mt-1 size-3.5 shrink-0",
            step.status === "failed"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        />
        {!last && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>

      <div className="min-w-0 flex-1 pb-0.5">
        <button
          type="button"
          disabled={!expandable}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={expandable ? open : undefined}
          className={cn(
            "group flex w-full min-w-0 items-center gap-1.5 rounded py-0.5 text-left text-xs",
            expandable && "cursor-pointer"
          )}
        >
          <span
            className={cn(
              "shrink-0 font-medium",
              step.status === "running" && "shimmer-text",
              step.status === "failed" ? "text-destructive" : "text-foreground"
            )}
          >
            {step.label}
          </span>
          {tail !== null && (
            <span className="truncate text-muted-foreground">{tail}</span>
          )}
          {step.durationMs !== null && step.durationMs >= 1000 && (
            <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
              {formatDuration(step.durationMs)}
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {expandable && (
              <IconChevronRight
                className={cn(
                  "size-3 text-muted-foreground/50 transition-transform duration-150 group-hover:text-muted-foreground",
                  open && "rotate-90"
                )}
              />
            )}
            <StatusIcon status={step.status} />
          </span>
        </button>

        {expandable && (
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-2 pt-1.5 pb-2">
                {step.input !== null && (
                  <Payload
                    title={step.thinking ? "Reasoning" : "Input"}
                    body={step.input}
                  />
                )}
                {step.output !== null && (
                  <Payload
                    title={step.thinking ? "Reasoning" : "Output"}
                    body={step.output}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function WorkLog({
  steps,
  running,
}: {
  readonly steps: ReadonlyArray<WorkStep>
  readonly running: boolean
}) {
  const [readerChoice, setReaderChoice] = useState<boolean | null>(null)
  const followTheTurn = readerChoice === null
  const open = followTheTurn ? running : readerChoice

  const failures = steps.filter((s) => s.status === "failed").length
  const elapsed = elapsedMs(steps)
  const summary = [
    `${steps.length} ${steps.length === 1 ? "step" : "steps"}`,
    elapsed !== null && elapsed >= 1000 ? formatDuration(elapsed) : null,
    failures > 0 ? `${failures} failed` : null,
  ]
    .filter((part) => part !== null)
    .join(" · ")

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setReaderChoice(!open)}
        aria-expanded={open}
        className="group flex cursor-pointer items-center gap-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconChevronRight
          className={cn(
            "size-3.5 transition-transform duration-150",
            open && "rotate-90"
          )}
        />
        <span className={cn(failures > 0 && "text-destructive")}>
          {summary}
        </span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col pt-1 pl-1.5">
            {steps.map((step, i) => (
              <WorkStepRow
                key={step.id}
                step={step}
                last={i === steps.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
