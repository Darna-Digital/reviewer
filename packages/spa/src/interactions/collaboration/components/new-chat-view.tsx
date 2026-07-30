/**
 * The new-chat surface: one prompt, the agent it goes to, and the project it is
 * about. Nothing is sent yet — the composer is the prototype's front door.
 */
import {
  IconSend,
  IconCheck,
  IconChevronDown,
  IconCube,
  IconPaperclip,
  IconRobot,
  IconSparkles,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useState, type CSSProperties } from "react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PaneHeader } from "@/interactions/collaboration/components/pane-header"
import {
  AGENTS,
  CHAT_PROMPTS,
  PROJECTS,
} from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

const CHIP =
  "flex h-7 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"

function PickerRow({
  selected,
  title,
  detail,
  mark,
  onSelect,
}: {
  selected: boolean
  title: string
  detail: string
  mark: React.ReactNode
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-elevate focus-visible:bg-elevate"
    >
      {mark}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
      {selected && <IconCheck className="size-4 shrink-0" />}
    </button>
  )
}

export function NewChatView() {
  const [prompt, setPrompt] = useState("")
  const [agentId, setAgentId] = useState(AGENTS[0]?.id)
  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [agentOpen, setAgentOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)

  const agent = AGENTS.find((a) => a.id === agentId) ?? AGENTS[0]
  const project = PROJECTS.find((p) => p.id === projectId)

  return (
    <>
      <PaneHeader
        crumbs={[
          <Link
            key="inbox"
            to="/inbox"
            className="text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            Inbox
          </Link>,
          <span key="chat" className="font-medium">
            New chat
          </span>,
        ]}
        meta={agent === undefined ? undefined : `Goes to ${agent.name}`}
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-16">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-balance">
            What should we work on?
          </h1>

          <div className="mt-8 rounded-2xl border bg-elevate">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Ask ${agent?.name ?? "an agent"} to do something`}
              className="w-full resize-none bg-transparent px-4 pt-3.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-1 p-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-full"
                aria-label="Attach a file"
              >
                <IconPaperclip className="size-4" />
              </Button>

              <Popover open={agentOpen} onOpenChange={setAgentOpen}>
                <PopoverTrigger
                  render={
                    <button type="button" className={cn(CHIP, "shrink-0")} />
                  }
                >
                  <IconRobot className="size-4 shrink-0" />
                  <span className="truncate text-foreground">
                    {agent?.name}
                  </span>
                  <IconChevronDown className="size-3.5 shrink-0" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 gap-0 p-1.5">
                  {AGENTS.map((a) => (
                    <PickerRow
                      key={a.id}
                      selected={a.id === agent?.id}
                      title={a.name}
                      detail={a.detail}
                      onSelect={() => {
                        setAgentId(a.id)
                        setAgentOpen(false)
                      }}
                      mark={
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            a.online
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/40"
                          )}
                        />
                      }
                    />
                  ))}
                </PopoverContent>
              </Popover>

              <Popover open={projectOpen} onOpenChange={setProjectOpen}>
                <PopoverTrigger
                  render={<button type="button" className={CHIP} />}
                >
                  <IconCube className="size-4 shrink-0" />
                  <span className="truncate">
                    {project?.name ?? "Choose project"}
                  </span>
                  <IconChevronDown className="size-3.5 shrink-0" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 gap-0 p-1.5">
                  {PROJECTS.map((p) => (
                    <PickerRow
                      key={p.id}
                      selected={p.id === project?.id}
                      title={p.name}
                      detail={p.summary}
                      onSelect={() => {
                        setProjectId(p.id)
                        setProjectOpen(false)
                      }}
                      mark={
                        <span
                          className="size-4 shrink-0 rounded-md bg-(--mark)"
                          style={{ "--mark": p.color } as CSSProperties}
                        />
                      }
                    />
                  ))}
                </PopoverContent>
              </Popover>

              <Button
                size="icon-sm"
                className="ml-auto shrink-0 rounded-full"
                disabled={prompt.trim().length === 0}
                aria-label="Start chat"
              >
                <IconSend className="size-4" />
              </Button>
            </div>
          </div>

          <ul role="list" className="mt-6 flex flex-col">
            {CHAT_PROMPTS.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:bg-elevate"
                >
                  <IconSparkles className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">{suggestion}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </ScrollArea>
    </>
  )
}
