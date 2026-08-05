/**
 * A public channel — open to the whole workspace, no request to make. It takes
 * agents on the same terms a chat does: your own CLIs plus whatever the
 * workspace runs in the cloud, which is why the same strip sits on both
 * composers.
 */
import { IconDots, IconWorld } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card";
import { AgentMark } from "@/interactions/threads/components/agent-mark";
import { ConversationAgents } from "@/interactions/collaboration/components/conversation-agents";
import { MessageList } from "@/interactions/collaboration/components/message-list";
import { MessageComposer } from "@/interactions/collaboration/components/message-composer";
import { PaneBody, PaneHeader } from "@/components/layout/pane-header";
import {
  agentName,
  agentsIn,
  findProject,
  MESSAGES,
  type MockChannel,
} from "@/interactions/collaboration/data/collaboration.mock";
import { useChats } from "@/interactions/collaboration/data/use-chats";

export function ChannelView({ channel }: { channel: MockChannel }) {
  useChats();
  const messages = MESSAGES[channel.id] ?? [];
  const project =
    channel.projectId === undefined
      ? undefined
      : findProject(channel.projectId);
  const agents = agentsIn(channel.id);
  const memberAuthors = [...new Set(messages.map((m) => m.author))].filter(
    (name) => !agents.some((agent) => agentName(agent) === name)
  );

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
          <span key="name" className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">#{channel.name}</span>
            <Popover>
              <PopoverTrigger
                render={
                  <Badge
                    variant="outline"
                    className="h-5.5 gap-1 py-1 pr-2 pl-1.5 font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                    render={<button type="button" />}
                  />
                }
              >
                <IconWorld className="size-3 shrink-0" />
                Open channel
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 gap-2 p-3">
                <p className="text-[0.8125rem] font-medium">
                  Anyone in the workspace
                </p>
                <p className="text-xs text-pretty text-muted-foreground">
                  A channel needs no invitation — every member can read it and
                  post in it, and it is saved to the workspace the same way a
                  chat is.
                </p>
                <p className="text-xs text-pretty text-muted-foreground">
                  Bring your own agent in, or call one of the workspace&rsquo;s
                  cloud agents. Everyone here sees whose agent answered.
                </p>
              </PopoverContent>
            </Popover>
          </span>,
        ]}
        meta={channel.topic}
        actions={
          <>
            {agents.map((agent) => (
              <AgentHoverCard key={agent.id} agent={agent}>
                <AgentMark kind={agent.kind} />
              </AgentHoverCard>
            ))}
            <AvatarStack names={memberAuthors} />
            <Button variant="ghost" size="icon-sm" aria-label="Channel options">
              <IconDots className="size-4" />
            </Button>
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <MessageList messages={messages} empty="Nothing posted here yet." />
        </PaneBody>
      </ScrollArea>

      <div className="mx-auto w-full max-w-3xl shrink-0 px-4">
        <ConversationAgents conversationId={channel.id} canEdit />
      </div>
      <MessageComposer placeholder={`Message #${channel.name}`} />
    </>
  );
}
