/**
 * The small marks that carry a task's state in a list: its status ring and its
 * priority bars.
 *
 * They are drawn rather than borrowed from the icon set because both encode a
 * value on a scale, and the scale has to be legible at 14px and at a glance —
 * a ring that fills as work progresses, and bars that grow with urgency. Each
 * names itself, so the meaning survives for anyone reading the row with a
 * screen reader or hovering to check — except where the value is already
 * written out beside the mark, which is what `decorative` is for.
 */
import type { AccentColor } from "@byconvo/core/projects"
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@byconvo/core/tasks"
import { cn } from "@/lib/utils"

/**
 * Accent colours resolve through CSS variables so both themes pick their own
 * ink for the same name. Spelled out because Tailwind only emits classes it
 * finds as literal strings.
 */
export const ACCENT_TEXT: Record<AccentColor, string> = {
  gray: "text-zinc-500 dark:text-zinc-400",
  blue: "text-sky-600 dark:text-sky-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  purple: "text-violet-600 dark:text-violet-400",
  pink: "text-pink-600 dark:text-pink-400",
  red: "text-red-600 dark:text-red-400",
  orange: "text-orange-600 dark:text-orange-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
  teal: "text-teal-600 dark:text-teal-400",
}

export const ACCENT_DOT: Record<AccentColor, string> = {
  gray: "bg-zinc-400 dark:bg-zinc-500",
  blue: "bg-sky-500",
  indigo: "bg-indigo-500",
  purple: "bg-violet-500",
  pink: "bg-pink-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
}

/** How far round the ring is drawn, and what colour it reads as. */
const STATUS_PAINT: Record<
  TaskStatus,
  {
    readonly fraction: number
    readonly className: string
    readonly dashed?: boolean
  }
> = {
  backlog: { fraction: 0, className: "text-muted-foreground", dashed: true },
  todo: { fraction: 0, className: "text-muted-foreground" },
  in_progress: { fraction: 0.5, className: "text-amber-500" },
  in_review: { fraction: 0.75, className: "text-emerald-500" },
  paused: { fraction: 0.25, className: "text-rose-400" },
  done: { fraction: 1, className: "text-indigo-500" },
  canceled: { fraction: 1, className: "text-muted-foreground" },
}

const RADIUS = 6
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function StatusIcon({
  status,
  className,
  decorative = false,
}: {
  status: TaskStatus
  className?: string
  /** Set where the status is already written out beside the mark. */
  decorative?: boolean
}) {
  const paint = STATUS_PAINT[status]
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3.5 shrink-0", paint.className, className)}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": STATUS_LABEL[status] })}
    >
      {!decorative && <title>{STATUS_LABEL[status]}</title>}
      <circle
        cx="8"
        cy="8"
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={paint.fraction === 1 ? 1 : 0.45}
        strokeDasharray={paint.dashed === true ? "2 2" : undefined}
      />
      {/* The progress arc starts at twelve o'clock and sweeps clockwise. */}
      {paint.fraction > 0 && paint.fraction < 1 && (
        <circle
          cx="8"
          cy="8"
          r={RADIUS / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={RADIUS}
          strokeDasharray={`${(CIRCUMFERENCE / 2) * paint.fraction} ${CIRCUMFERENCE}`}
          transform="rotate(-90 8 8)"
        />
      )}
      {status === "done" && (
        <path
          d="M5 8.2 7 10.2 11 5.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {status === "canceled" && (
        <path
          d="M5.6 5.6 10.4 10.4M10.4 5.6 5.6 10.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

/** Bar heights per priority — the taller the block, the more urgent. */
const PRIORITY_BARS: Record<TaskPriority, ReadonlyArray<number>> = {
  none: [],
  low: [5],
  medium: [5, 8],
  high: [5, 8, 11],
  urgent: [],
}

export function PriorityIcon({
  priority,
  className,
  decorative = false,
}: {
  priority: TaskPriority
  className?: string
  /** Set where the priority is already written out beside the mark. */
  decorative?: boolean
}) {
  const label = PRIORITY_LABEL[priority]

  if (priority === "urgent") {
    return (
      <span
        {...(decorative
          ? { "aria-hidden": true }
          : { role: "img", "aria-label": label, title: label })}
        className={cn(
          "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] bg-orange-500 text-[10px] leading-none font-bold text-white",
          className
        )}
      >
        !
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 14 14"
      className={cn(
        "size-3.5 shrink-0",
        priority === "none" ? "text-muted-foreground/50" : "text-foreground/70",
        className
      )}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label })}
    >
      {!decorative && <title>{label}</title>}
      {[0, 1, 2].map((index) => {
        const height = PRIORITY_BARS[priority][index]
        const filled = height !== undefined
        const drawn = height ?? 5
        return (
          <rect
            key={index}
            x={1 + index * 4.5}
            y={12 - drawn}
            width="3"
            height={drawn}
            rx="1"
            fill="currentColor"
            opacity={filled ? 1 : 0.3}
          />
        )
      })}
    </svg>
  )
}

export function LabelChip({
  name,
  color,
  className,
}: {
  name: string
  color: AccentColor
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-sm whitespace-nowrap text-muted-foreground ring-1 ring-foreground/10 sm:h-5 sm:text-xs",
        className
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", ACCENT_DOT[color])} />
      {name}
    </span>
  )
}

/** The square that stands in for a project in the sidebar and the header. */
export function ProjectGlyph({
  name,
  color,
  className,
}: {
  name: string
  color: AccentColor
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md text-[0.625rem] font-semibold text-white uppercase",
        ACCENT_DOT[color],
        className
      )}
      aria-hidden
    >
      {name.trim().slice(0, 1)}
    </span>
  )
}
