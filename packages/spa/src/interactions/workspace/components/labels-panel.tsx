/**
 * The labels tab: the project's label set, and how many issues carry each.
 *
 * Deleting a label unpins it from every issue rather than deleting them, which
 * the copy says out loud — it is the one destructive action here whose blast
 * radius is not obvious from the row.
 */
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { ACCENT_COLORS } from "@byconvo/core/projects"
import type { AccentColor } from "@byconvo/core/projects"
import type { Label } from "@byconvo/core/labels"
import type { Task } from "@byconvo/core/tasks"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { labelsCollection } from "@/lib/central/collections"
import { ACCENT_DOT } from "./issue-glyphs"

const report = (error: unknown, fallback: string) =>
  toast.error(error instanceof Error ? error.message : fallback)

export function LabelsPanel({
  projectId,
  labels,
  tasks,
}: {
  projectId: string
  labels: ReadonlyArray<Label>
  tasks: ReadonlyArray<Task>
}) {
  const collection = labelsCollection(projectId)
  const [name, setName] = useState("")

  const usage = (labelId: string) =>
    tasks.filter((task) => task.labelIds.includes(labelId)).length

  const add = () => {
    const trimmed = name.trim()
    if (trimmed.length === 0) return
    try {
      collection.insert({
        id: `pending-${crypto.randomUUID()}`,
        projectId,
        name: trimmed,
        // The server picks the project's next unused colour; this is only what
        // the row looks like for the moment before it answers.
        color: "gray",
        createdAt: new Date().toISOString(),
      })
      setName("")
    } catch (error) {
      report(error, "could not create the label")
    }
  }

  const recolour = (id: string, color: AccentColor) => {
    try {
      collection.update(id, (draft) => {
        draft.color = color
      })
    } catch (error) {
      report(error, "could not change the colour")
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl overflow-y-auto p-6">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          placeholder="New label name"
          aria-label="New label name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
          className="h-8 max-w-xs"
        />
        <Button
          size="sm"
          disabled={name.trim().length === 0}
          onClick={add}
          data-icon="inline-start"
        >
          <IconPlus />
          Add label
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border">
        {labels.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No labels yet. Labels group issues across statuses.
          </p>
        )}
        {labels.map((label) => (
          <div
            key={label.id}
            className="group flex h-11 items-center gap-3 border-b px-3 last:border-b-0"
          >
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Change the colour of ${label.name}`}
                className="flex size-5 items-center justify-center rounded-full hover:bg-elevate"
              >
                <span
                  className={`size-3 rounded-full ${ACCENT_DOT[label.color]}`}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {ACCENT_COLORS.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    onClick={() => recolour(label.id, color)}
                  >
                    <span
                      className={`size-3 rounded-full ${ACCENT_DOT[color]}`}
                    />
                    <span className="capitalize">{color}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="min-w-0 flex-1 truncate text-sm">
              {label.name}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {usage(label.id)} issue{usage(label.id) === 1 ? "" : "s"}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Delete ${label.name}`}
              title={`Removes "${label.name}" from every issue that carries it`}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              onClick={() => {
                try {
                  collection.delete(label.id)
                } catch (error) {
                  report(error, "could not delete the label")
                }
              }}
            >
              <IconTrash />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
