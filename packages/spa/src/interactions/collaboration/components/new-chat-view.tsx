/**
 * New message — Slack's compose window: a To field that takes members, agents
 * and channels alike, with the message below it. Nothing sends yet.
 */
import {
  IconBolt,
  IconCheck,
  IconChevronDown,
  IconCloud,
  IconDatabase,
  IconHash,
  IconLock,
  IconPaperclip,
  IconSend,
  IconShieldCheck,
  IconTerminal2,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { RepoPicker } from "@/components/repo-picker";
import { AgentMark } from "@/interactions/threads/components/agent-mark";
import { PaneHeader } from "@/components/layout/pane-header";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import {
  useBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import {
  agentName,
  callableBy,
  CHANNELS,
  MEMBERS,
  PROJECTS,
  VIEWER,
} from "@/interactions/collaboration/data/collaboration.mock";
import type { AgentKind } from "@byconvo/core/threads";
import { cn } from "@/lib/utils";

interface Recipient {
  id: string;
  kind: "member" | "agent" | "channel";
  name: string;
  detail: string;
  /** Which CLI to draw, on an agent recipient. */
  agent?: AgentKind;
  /** Set on a cloud agent, which anyone in the workspace may start with. */
  cloud?: boolean;
}

/**
 * Read per render, so an agent added this session can be messaged straight
 * away. Only the agents you can actually call are offered: yours and the
 * workspace's. A teammate's CLI joins when they bring it, not when you list it.
 */
const recipients = (): ReadonlyArray<Recipient> => [
  ...MEMBERS.map((m) => ({
    id: `member-${m.id}`,
    kind: "member" as const,
    name: m.name,
    detail: m.detail,
  })),
  ...callableBy(VIEWER.name).map((a) => ({
    id: `agent-${a.id}`,
    kind: "agent" as const,
    name: agentName(a),
    detail: a.detail,
    agent: a.kind,
    cloud: a.runtime === "cloud",
  })),
  ...CHANNELS.map((c) => ({
    id: `channel-${c.id}`,
    kind: "channel" as const,
    name: c.name,
    detail: c.topic,
  })),
];

const label = (recipient: Recipient) =>
  recipient.kind === "channel" ? `#${recipient.name}` : recipient.name;

function RecipientIcon({
  recipient,
  className,
}: {
  recipient: Recipient;
  className?: string;
}) {
  if (recipient.kind === "channel") {
    return (
      <IconHash
        className={cn("size-4 shrink-0 text-muted-foreground", className)}
      />
    );
  }
  if (recipient.agent !== undefined) {
    return (
      <AgentMark kind={recipient.agent} className={cn("size-5", className)} />
    );
  }
  return <Avatar name={recipient.name} className={cn("size-5", className)} />;
}

function Chip({
  recipient,
  onRemove,
}: {
  recipient: Recipient;
  onRemove: () => void;
}) {
  return (
    <span className="flex h-6 items-center gap-1.5 rounded-md bg-muted py-1 pr-1 pl-1.5 text-[13px]">
      <RecipientIcon recipient={recipient} className="size-4" />
      {label(recipient)}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${recipient.name}`}
        className="grid size-4 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <IconX className="size-3" />
      </button>
    </span>
  );
}

function RecipientRow({
  recipient,
  onSelect,
}: {
  recipient: Recipient;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex h-9 w-full items-center gap-2.5 px-3 text-left text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate"
    >
      <RecipientIcon recipient={recipient} />
      <span className="shrink-0 font-medium">{label(recipient)}</span>
      {recipient.cloud === true && (
        <IconCloud
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-label="Runs in the workspace cloud"
        />
      )}
      <span className="min-w-0 truncate text-muted-foreground">
        {recipient.detail}
      </span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

const CHIP =
  "flex h-7 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30";

/** How much the agent may do on its own before it comes back to ask. */
const PERMISSIONS = [
  { id: "ask", label: "Ask every time", detail: "Every edit and command" },
  { id: "edits", label: "Approve edits", detail: "Commands still ask" },
  { id: "full", label: "Full access", detail: "Edits, commands, git" },
];

const EFFORTS = [
  { id: "high", label: "High", detail: "Slower, thinks it through" },
  { id: "medium", label: "Medium", detail: "The usual balance" },
  { id: "low", label: "Low", detail: "Quick passes" },
];

/** Public is the default, so it is the first option and the one already set. */
const VISIBILITY = [
  { id: "public", label: "Public", detail: "The project can read and join" },
  { id: "private", label: "Private", detail: "Only the people you add" },
];

const PROJECT_OPTIONS = PROJECTS.map((project) => ({
  id: project.id,
  label: project.name,
  detail: `${project.lead} · ${project.target}`,
}));

function ChipPicker({
  icon,
  value,
  options,
  onSelect,
}: {
  icon: ReactNode;
  value: string;
  options: ReadonlyArray<{ id: string; label: string; detail: string }>;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? options[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" className={CHIP} />}>
        {icon}
        <span className="truncate">{selected?.label}</span>
        <IconChevronDown className="size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              onSelect(option.id);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-elevate focus-visible:bg-elevate"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {option.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {option.detail}
              </span>
            </span>
            {option.id === selected?.id && (
              <IconCheck className="size-4 shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function NewChatView() {
  const [chosen, setChosen] = useState<ReadonlyArray<Recipient>>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState("edits");
  const [effort, setEffort] = useState("high");
  const [visibility, setVisibility] = useState("public");
  const [projectId, setProjectId] = useState(PROJECT_OPTIONS[0]?.id ?? "");
  const [repoOpen, setRepoOpen] = useState(false);
  const repo = useRepo();
  const workspace = useWorkspace();
  const branches = useBranches();
  const remoteBranches = useRemoteBranches();
  const git = useGitActions();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients().filter(
      (r) =>
        !chosen.some((c) => c.id === r.id) &&
        (q.length === 0 ||
          r.name.toLowerCase().includes(q) ||
          r.detail.toLowerCase().includes(q))
    );
  }, [chosen, query]);

  const add = (recipient: Recipient) => {
    setChosen([...chosen, recipient]);
    setQuery("");
  };

  const group = (kind: Recipient["kind"]) =>
    matches.filter((r) => r.kind === kind);
  const toAgent = chosen.some((c) => c.kind === "agent");
  const suggesting = query.length > 0 || chosen.length === 0;
  const isPublic = visibility === "public";
  const projectName =
    PROJECT_OPTIONS.find((p) => p.id === projectId)?.label ?? "the project";

  return (
    <>
      <PaneHeader
        crumbs={[
          <Link
            key="inbox"
            to="/modes/collaboration/inbox"
            className="text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            Inbox
          </Link>,
          <span key="new" className="font-medium">
            New message
          </span>,
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-start gap-2 border-b px-4 py-2.5">
          <span className="pt-1 text-[13px] text-muted-foreground">To:</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {chosen.map((recipient) => (
              <Chip
                key={recipient.id}
                recipient={recipient}
                onRemove={() =>
                  setChosen(chosen.filter((c) => c.id !== recipient.id))
                }
              />
            ))}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && query.length === 0) {
                  setChosen(chosen.slice(0, -1));
                }
                if (e.key === "Enter" && matches[0] !== undefined) {
                  e.preventDefault();
                  add(matches[0]);
                }
              }}
              placeholder={
                chosen.length === 0
                  ? "#a-channel, a teammate or an agent"
                  : undefined
              }
              className="h-7 min-w-40 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {suggesting && (
          <ScrollArea
            className="max-h-80 shrink-0 border-b"
            viewportClassName="scroll-fade"
          >
            {group("agent").length > 0 && (
              <Group title="Agents">
                {group("agent").map((recipient) => (
                  <RecipientRow
                    key={recipient.id}
                    recipient={recipient}
                    onSelect={() => add(recipient)}
                  />
                ))}
              </Group>
            )}
            {group("member").length > 0 && (
              <Group title="Members">
                {group("member").map((recipient) => (
                  <RecipientRow
                    key={recipient.id}
                    recipient={recipient}
                    onSelect={() => add(recipient)}
                  />
                ))}
              </Group>
            )}
            {group("channel").length > 0 && (
              <Group title="Channels">
                {group("channel").map((recipient) => (
                  <RecipientRow
                    key={recipient.id}
                    recipient={recipient}
                    onSelect={() => add(recipient)}
                  />
                ))}
              </Group>
            )}
            {matches.length === 0 && (
              <p className="px-3 py-3 text-[13px] text-muted-foreground">
                Nobody matches that.
              </p>
            )}
          </ScrollArea>
        )}

        <div className="min-h-0 flex-1" />

        <div className="shrink-0 p-4">
          <div className="rounded-xl border bg-elevate">
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                chosen.length === 0
                  ? "Write a message"
                  : `Message ${chosen.map(label).join(", ")}`
              }
              className="w-full resize-none bg-transparent px-3 pt-3 text-sm outline-none placeholder:text-muted-foreground"
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
              <ChipPicker
                icon={
                  isPublic ? (
                    <IconWorld className="size-4 shrink-0" />
                  ) : (
                    <IconLock className="size-4 shrink-0" />
                  )
                }
                value={visibility}
                options={VISIBILITY}
                onSelect={setVisibility}
              />
              {isPublic && (
                <ChipPicker
                  icon={<IconHash className="size-4 shrink-0" />}
                  value={projectId}
                  options={PROJECT_OPTIONS}
                  onSelect={setProjectId}
                />
              )}
              {toAgent && (
                <>
                  <ChipPicker
                    icon={<IconShieldCheck className="size-4 shrink-0" />}
                    value={permission}
                    options={PERMISSIONS}
                    onSelect={setPermission}
                  />
                  <ChipPicker
                    icon={<IconBolt className="size-4 shrink-0" />}
                    value={effort}
                    options={EFFORTS}
                    onSelect={setEffort}
                  />
                </>
              )}
              <Button
                size="icon-sm"
                className="ml-auto shrink-0 rounded-full"
                disabled={message.trim().length === 0 || chosen.length === 0}
                aria-label="Send message"
              >
                <IconSend className="size-4" />
              </Button>
            </div>
          </div>

          <p className="mt-2 flex items-start gap-1.5 px-1 text-xs text-pretty text-muted-foreground">
            <IconDatabase className="size-3.5 shrink-0 translate-y-px" />
            {isPublic
              ? `Saved to the workspace, not this machine. Everyone on ${projectName} will find it and can ask you to let them in.`
              : "Saved to the workspace, not this machine. Only the people you put in it will see it."}
          </p>

          {/* Where the agent runs: the repository the app has open and the
              branch it is on — the same pickers as the title bar, opening
              upward from this bar. */}
          {toAgent && (
            <div className="mt-1 flex h-10 items-center gap-1 rounded-xl border px-1.5">
              <RepoPicker
                repo={repo.data ?? null}
                workspace={workspace.data}
                open={repoOpen}
                onOpenChange={setRepoOpen}
                onChosen={() => {}}
                side="top"
              />
              {repo.data !== undefined && (
                <BranchSwitcher
                  current={repo.data.currentBranch ?? null}
                  branches={branches.data ?? []}
                  remoteBranches={remoteBranches.data ?? []}
                  busy={false}
                  side="top"
                  onCheckout={(b) => void git.checkout(b)}
                  onCheckoutAndUpdate={(b) => void git.checkoutAndUpdate(b)}
                  onCreateBranch={(name, sp) => void git.createBranch(name, sp)}
                  onCompare={() => {}}
                  onMerge={(b) => void git.merge(b)}
                  onRebase={(o) => void git.rebase(o)}
                  onRenameBranch={(from, to) => void git.renameBranch(from, to)}
                  onDeleteBranch={(name) => void git.deleteBranch(name)}
                  onFetch={() => void git.fetch()}
                  onPull={() => void git.pull()}
                  onPush={() => void git.push()}
                />
              )}
              <span className="ml-auto flex items-center gap-1.5 pr-1.5 text-xs text-muted-foreground">
                <IconTerminal2 className="size-4 shrink-0" />
                Runs on this machine
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
