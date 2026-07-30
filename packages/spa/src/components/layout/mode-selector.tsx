/**
 * ModeSelector — the title bar's leading chip. It picks how the app is framed
 * (Code vs Collaboration) and routes to that mode's home; the choice is
 * remembered so the chip still reads right after a reload.
 */
import { IconCheck, IconChevronDown } from "@tabler/icons-react"
import { useNavigate, useRouterState } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { setUiPrefs, useUiPrefs, type WorkMode } from "@/lib/ui-prefs"
import { activeWorkMode } from "@/lib/work-mode"

const MODES: ReadonlyArray<{
  mode: WorkMode
  title: string
  detail: string
  to: string
}> = [
  {
    mode: "code",
    title: "Code",
    detail: "Focus on technical details in a detailed view",
    to: "/browse",
  },
  {
    mode: "collaboration",
    title: "Collaboration",
    detail: "Collaborate with humans and agents",
    to: "/modes/collaboration",
  },
]

export function ModeSelector() {
  const { workMode } = useUiPrefs()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const active = activeWorkMode(pathname, workMode)
  const selected = MODES.find((m) => m.mode === active) ?? MODES[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full px-3.5 py-1.5 font-semibold"
          />
        }
      >
        <span className="truncate">{selected?.title}</span>
        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-1.5">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-elevate focus-visible:bg-elevate"
            onClick={() => {
              setUiPrefs({ workMode: m.mode })
              setOpen(false)
              void navigate({ to: m.to })
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{m.title}</span>
              <span className="block text-sm text-muted-foreground">
                {m.detail}
              </span>
            </span>
            {m.mode === active && (
              <IconCheck className="mt-0.5 size-4 shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
