/**
 * The labels tab: the project's label set, and how many tasks carry each.
 *
 * Deleting a label unpins it from every task rather than deleting them, which
 * the copy says out loud — it is the one destructive action here whose blast
 * radius is not obvious from the row.
 */
import { IconPlus, IconTag, IconTrash } from "@tabler/icons-react"
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
import { ACCENT_DOT } from "./task-glyphs"

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
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-medium tracking-tight">Labels</h2>
          <p className="max-w-[56ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
            Labels cut across statuses — one task can carry several, and the
            task list filters on them.
          </p>
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <Input
            value={name}
            placeholder="New label name"
            aria-label="New label name"
            onChange={(event) => setName(event.target.value)}
            className="max-w-xs"
          />
          <Button
            type="submit"
            disabled={name.trim().length === 0}
            data-icon="inline-start"
          >
            <IconPlus />
            Add label
          </Button>
        </form>

        {labels.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-3xl border border-dashed border-foreground/15 px-6 py-14 text-center">
            <IconTag className="size-4 shrink-0 text-muted-foreground" />
            <p className="mt-2 text-base font-medium sm:text-sm">
              No labels yet
            </p>
            <p className="max-w-[48ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
              Add one above and it becomes available on every task in this
              project.
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-foreground/10">
            {labels.map((label) => {
              const count = usage(label.id)
              return (
                <li
                  key={label.id}
                  className="group flex h-12 items-center gap-3"
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={`Change the colour of ${label.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-elevate aria-expanded:bg-elevate"
                    >
                      <span
                        className={`size-3 shrink-0 rounded-full ${ACCENT_DOT[label.color]}`}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {ACCENT_COLORS.map((color) => (
                        <DropdownMenuItem
                          key={color}
                          onClick={() => recolour(label.id, color)}
                        >
                          <span
                            className={`size-3 shrink-0 rounded-full ${ACCENT_DOT[color]}`}
                          />
                          <span className="capitalize">{color}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <p className="min-w-0 flex-1 truncate text-base sm:text-sm">
                    {label.name}
                  </p>
                  <p className="shrink-0 text-base text-muted-foreground tabular-nums sm:text-sm">
                    {count} task{count === 1 ? "" : "s"}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${label.name}`}
                    title={`Removes "${label.name}" from every task that carries it`}
                    className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
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
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
