import { IconDots } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { Avatar, AvatarStack } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageComposer } from "@/interactions/collaboration/components/message-composer"
import {
  PaneBody,
  PaneHeader,
} from "@/interactions/collaboration/components/pane-header"
import {
  AGENTS,
  findProject,
  MESSAGES,
  type MockChannel,
  type MockMessage,
} from "@/interactions/collaboration/data/collaboration.mock"

interface MessageRun {
  day: string
  author: string
  time: string
  messages: MockMessage[]
}

/** Consecutive messages from one author on one day read as a single block. */
const runsOf = (messages: ReadonlyArray<MockMessage>) => {
  const runs: MessageRun[] = []
  for (const message of messages) {
    const last = runs.at(-1)
    if (
      last !== undefined &&
      last.day === message.day &&
      last.author === message.author
    ) {
      last.messages.push(message)
    } else {
      runs.push({
        day: message.day,
        author: message.author,
        time: message.time,
        messages: [message],
      })
    }
  }
  return runs
}

const isAgent = (name: string) => AGENTS.some((a) => a.name === name)

function DayDivider({ day }: { day: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{day}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function ChannelView({ channel }: { channel: MockChannel }) {
  const messages = MESSAGES[channel.id] ?? []
  const runs = runsOf(messages)
  const project =
    channel.projectId === undefined ? undefined : findProject(channel.projectId)
  const authors = [...new Set(messages.map((m) => m.author))]

  return (
    <>
      <PaneHeader
        crumbs={[
          ...(project === undefined
            ? [
                <span key="section" className="text-muted-foreground">
                  Channels
                </span>,
              ]
            : [
                <Link
                  key="project"
                  to="/modes/collaboration"
                  search={{ view: "project", id: project.id }}
                  className="truncate text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                >
                  {project.name}
                </Link>,
              ]),
          <span key="name" className="truncate font-medium">
            #{channel.name}
          </span>,
        ]}
        meta={channel.topic}
        actions={
          <>
            <AvatarStack names={authors} />
            <Button variant="ghost" size="icon-sm" aria-label="Channel options">
              <IconDots className="size-4" />
            </Button>
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <div className="flex flex-col gap-5">
            {runs.map((run, index) => (
              <div key={run.messages[0]?.id} className="flex flex-col gap-5">
                {run.day !== runs[index - 1]?.day && (
                  <DayDivider day={run.day} />
                )}
                <div className="flex gap-3">
                  <Avatar name={run.author} className="mt-0.5 size-7" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium">
                        {run.author}
                      </span>
                      {isAgent(run.author) && (
                        <Badge variant="outline" className="h-4.5 px-1.5">
                          Agent
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {run.time}
                      </span>
                    </div>
                    {run.messages.map((message) => (
                      <p
                        key={message.id}
                        className="mt-1 max-w-[70ch] text-sm text-pretty"
                      >
                        {message.body}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {runs.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nothing posted here yet.
              </p>
            )}
          </div>
        </PaneBody>
      </ScrollArea>

      <MessageComposer placeholder={`Message #${channel.name}`} />
    </>
  )
}
