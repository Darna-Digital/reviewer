/**
 * A chat, which is public unless someone made it otherwise: it lives in the
 * workspace database rather than on the machine that started it, so anyone in
 * the project opens it and reads the whole thing. What you cannot do without
 * asking is post — joining is a request the person who started it answers, and
 * until they do the composer is replaced by the ask rather than disabled in
 * place, because a greyed-out box does not tell you what to do next.
 */
import {
  IconCheck,
  IconClock,
  IconDots,
  IconLock,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { Avatar, AvatarStack } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card"
import { AgentMark } from "@/interactions/collaboration/components/agent-mark"
import { ConversationAgents } from "@/interactions/collaboration/components/conversation-agents"
import {
  MessageList,
  SystemLine,
} from "@/interactions/collaboration/components/message-list"
import { MessageComposer } from "@/interactions/collaboration/components/message-composer"
import { PaneBody, PaneHeader } from "@/components/layout/pane-header"
import {
  agentsIn,
  approveJoinRequest,
  declineJoinRequest,
  findProject,
  membershipOf,
  MESSAGES,
  requestToJoin,
  VIEWER,
  withdrawJoinRequest,
  type MockChat,
  type MockJoinRequest,
} from "@/interactions/collaboration/data/collaboration.mock"
import { useChat } from "@/interactions/collaboration/data/use-chats"

const firstName = (name: string) => name.split(" ")[0] ?? name

/**
 * Where the chat lives and who may read it — the one thing a public-by-default
 * surface has to say out loud, kept to a badge until someone asks for the rest.
 */
function VisibilityBadge({
  chat,
  projectName,
}: {
  chat: MockChat
  projectName: string
}) {
  const isPublic = chat.visibility === "public"
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Badge
            variant="outline"
            className="h-5.5 cursor-default gap-1 py-1 pr-2 pl-1.5 font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
            render={<button type="button" />}
          />
        }
      >
        {isPublic ? (
          <IconWorld className="size-3 shrink-0" />
        ) : (
          <IconLock className="size-3 shrink-0" />
        )}
        {isPublic ? "Public" : "Private"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2 p-3">
        <p className="text-[0.8125rem] font-medium">
          {isPublic ? `Public in ${projectName}` : "Private chat"}
        </p>
        <p className="text-xs text-pretty text-muted-foreground">
          {isPublic
            ? `Every chat starts public. It is saved to the workspace, so anyone in ${projectName} can open it and read the whole thread — including the parts an agent wrote.`
            : `Only the people already in it can open this one. It is still saved to the workspace, but it stays out of ${projectName} for everyone else.`}
        </p>
        <p className="text-xs text-pretty text-muted-foreground">
          {isPublic
            ? `Reading does not make you a participant. To post, ask ${firstName(chat.initiator)} to let you in.`
            : `${firstName(chat.initiator)} started it and decides who else comes in.`}
        </p>
      </PopoverContent>
    </Popover>
  )
}

/** The initiator's queue — the half of the flow that only they ever see. */
function JoinRequests({
  chat,
  requests,
}: {
  chat: MockChat
  requests: ReadonlyArray<MockJoinRequest>
}) {
  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-3">
      <div className="rounded-xl border bg-elevate">
        <p className="border-b px-3 py-2 text-xs text-muted-foreground">
          {requests.length === 1
            ? "1 person wants to join"
            : `${requests.length} people want to join`}
        </p>
        <ul role="list" className="divide-y">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
            >
              <Avatar name={request.person} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium">
                  {request.person}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {request.note === ""
                    ? `Asked ${request.asked}`
                    : request.note}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="py-1.5 pr-2.5 pl-1.5 text-muted-foreground"
                  onClick={() => declineJoinRequest(chat.id, request.id)}
                >
                  <IconX className="size-4 shrink-0" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="py-1.5 pr-2.5 pl-1.5"
                  onClick={() => approveJoinRequest(chat.id, request.id)}
                >
                  <IconCheck className="size-4 shrink-0" />
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** What stands where the composer would be, for someone who is only reading. */
function JoinBar({
  chat,
  projectName,
  pending,
}: {
  chat: MockChat
  projectName: string
  pending: boolean
}) {
  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border border-dashed px-3 py-2.5">
        {pending ? (
          <IconClock className="size-4 shrink-0 self-start text-muted-foreground sm:self-center" />
        ) : (
          <IconWorld className="size-4 shrink-0 self-start text-muted-foreground sm:self-center" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-medium">
            {pending
              ? `Waiting on ${chat.initiator}`
              : "You are reading, not in it"}
          </p>
          <p className="text-xs text-pretty text-muted-foreground">
            {pending
              ? "You can post here the moment they approve. Nothing else changes in the meantime."
              : `Anyone in ${projectName} can read this chat. Ask ${firstName(chat.initiator)} to join and you can talk to the agents in here too.`}
          </p>
        </div>
        {pending ? (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => withdrawJoinRequest(chat.id)}
          >
            Withdraw
          </Button>
        ) : (
          <Button
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => requestToJoin(chat.id)}
          >
            Request to join
          </Button>
        )}
      </div>
    </div>
  )
}

export function ChatView({ chat: initial }: { chat: MockChat }) {
  const chat = useChat(initial.id) ?? initial
  const project = findProject(chat.projectId)
  const projectName = project?.name ?? "this project"
  const membership = membershipOf(chat)
  const joined = membership === "joined"
  const agents = agentsIn(chat.id)
  const isInitiator = chat.initiator === VIEWER.name

  return (
    <>
      <PaneHeader
        crumbs={[
          project === undefined ? (
            <span key="section" className="text-muted-foreground">
              Chats
            </span>
          ) : (
            <Link
              key="project"
              to="/modes/collaboration"
              search={{ view: "project", id: project.id }}
              className="truncate text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
            >
              {project.name}
            </Link>
          ),
          <span key="title" className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{chat.title}</span>
            <VisibilityBadge chat={chat} projectName={projectName} />
          </span>,
        ]}
        meta={`Started by ${chat.initiator} · saved to the workspace`}
        actions={
          <>
            {agents.map((agent) => (
              <AgentHoverCard key={agent.id} agent={agent}>
                <AgentMark kind={agent.kind} />
              </AgentHoverCard>
            ))}
            <AvatarStack names={chat.members} />
            <Button variant="ghost" size="icon-sm" aria-label="Chat options">
              <IconDots className="size-4" />
            </Button>
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <MessageList
            messages={MESSAGES[chat.id] ?? []}
            empty="Nothing posted here yet."
            footer={chat.joins.map((join) => (
              <SystemLine key={join.id}>
                {join.person} joined · {join.time}
              </SystemLine>
            ))}
          />
        </PaneBody>
      </ScrollArea>

      {isInitiator && chat.requests.length > 0 && (
        <JoinRequests chat={chat} requests={chat.requests} />
      )}

      <div className="mx-auto w-full max-w-3xl shrink-0 px-4">
        <ConversationAgents conversationId={chat.id} canEdit={joined} />
      </div>

      {joined ? (
        <MessageComposer placeholder={`Message ${chat.title}`} />
      ) : (
        <JoinBar
          chat={chat}
          projectName={projectName}
          pending={membership === "requested"}
        />
      )}
    </>
  )
}
