import { Avatar } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  PaneBody,
  PaneHeader,
} from "@/interactions/collaboration/components/pane-header"
import {
  AGENTS,
  MEMBERS,
} from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

const PEOPLE = {
  agents: {
    title: "Agents",
    meta: "Agents working alongside the team.",
    list: AGENTS,
  },
  members: {
    title: "Members",
    meta: "People in this workspace.",
    list: MEMBERS,
  },
}

export function PeopleView({
  kind,
  selectedId,
}: {
  kind: "agents" | "members"
  selectedId?: string
}) {
  const { title, meta, list } = PEOPLE[kind]
  const online = list.filter((p) => p.online).length

  return (
    <>
      <PaneHeader
        crumbs={[
          <span key="title" className="font-medium">
            {title}
          </span>,
        ]}
        actions={
          <span className="text-xs text-muted-foreground tabular-nums">
            {online} of {list.length} online
          </span>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{meta}</p>

          <ul role="list" className="mt-5 divide-y">
            {list.map((person) => (
              <li
                key={person.id}
                aria-current={person.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 py-3",
                  person.id === selectedId &&
                    "-mx-2 rounded-lg bg-muted px-2 [&+li]:border-transparent"
                )}
              >
                <Avatar name={person.name} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {person.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {person.detail}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      person.online
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40"
                    )}
                  />
                  {person.online ? "Online" : "Offline"}
                </span>
              </li>
            ))}
          </ul>
        </PaneBody>
      </ScrollArea>
    </>
  )
}
