/**
 * WorkspacePicker — the collaboration workspace chip in the title bar, beside
 * the mode selector. Which workspace is open is prototype-local state.
 */
import { IconCheck, IconChevronDown } from "@tabler/icons-react"
import { useState, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { WORKSPACES } from "@/interactions/collaboration/data/collaboration.mock"

export function WorkspacePicker() {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState(WORKSPACES[0]?.id)
  const selected = WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="max-w-56 gap-2 rounded-full px-3.5 py-1.5"
          />
        }
      >
        <span
          className="size-4 shrink-0 rounded-md bg-(--mark)"
          style={{ "--mark": selected?.color } as CSSProperties}
        />
        <span className="truncate">{selected?.name}</span>
        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-1.5">
        {WORKSPACES.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => {
              setId(w.id)
              setOpen(false)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-elevate focus-visible:bg-elevate"
          >
            <span
              className="size-5 shrink-0 rounded-md bg-(--mark)"
              style={{ "--mark": w.color } as CSSProperties}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {w.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {w.detail}
              </span>
            </span>
            {w.id === selected?.id && <IconCheck className="size-4 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
