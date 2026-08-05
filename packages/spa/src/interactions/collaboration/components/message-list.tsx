/**
 * The transcript both a channel and a chat show. Consecutive posts from one
 * author on one day read as a single block, and an agent wears its brand mark
 * plus the badge naming whose account it posts under — in a room where four
 * people can each bring their own Claude, "Claude" alone says nothing.
 */
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card"
import { AgentMark } from "@/interactions/collaboration/components/agent-mark"
import {
  findAgentById,
  managedBy,
  type MockAgent,
  type MockMessage,
} from "@/interactions/collaboration/data/collaboration.mock"
import type { ReactNode } from "react"

interface MessageRun {
  day: string
  author: string
  agent?: MockAgent
  time: string
  messages: MockMessage[]
}

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
        agent:
          message.agentId === undefined
            ? undefined
            : findAgentById(message.agentId),
        time: message.time,
        messages: [message],
      })
    }
  }
  return runs
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-xs text-muted-foreground">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Joining is part of the record, so it lands in the transcript, not a toast. */
export function SystemLine({ children }: { children: ReactNode }) {
  return <Rule>{children}</Rule>
}

export function MessageList({
  messages,
  empty,
  footer,
}: {
  messages: ReadonlyArray<MockMessage>
  empty: string
  /** System lines appended after the last post — joins, for a chat. */
  footer?: ReactNode
}) {
  const runs = runsOf(messages)

  if (runs.length === 0 && footer === undefined) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {runs.map((run, index) => (
        <div key={run.messages[0]?.id} className="flex flex-col gap-5">
          {run.day !== runs[index - 1]?.day && <Rule>{run.day}</Rule>}
          <div className="flex gap-3">
            {run.agent === undefined ? (
              <Avatar name={run.author} className="mt-0.5 size-7" />
            ) : (
              <AgentHoverCard agent={run.agent}>
                <AgentMark
                  kind={run.agent.kind}
                  className="mt-0.5 size-7 rounded-lg"
                />
              </AgentHoverCard>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[0.8125rem] font-medium">
                  {run.author}
                </span>
                {run.agent !== undefined && (
                  <Badge variant="outline" className="h-4.5 px-1.5">
                    {managedBy(run.agent.id)}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {run.time}
                </span>
              </div>
              {run.messages.map((message) => (
                <p
                  key={message.id}
                  className="mt-1 max-w-[70ch] text-base text-pretty sm:text-sm"
                >
                  {message.body}
                </p>
              ))}
            </div>
          </div>
        </div>
      ))}
      {footer}
    </div>
  )
}
