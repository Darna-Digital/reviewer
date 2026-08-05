/**
 * Adding an agent to the workspace. The CLI is the real choice, so it is a row
 * of tiles rather than a dropdown — the brand marks make it a glance instead of
 * a read, and a tile the chosen owner already runs is disabled in place, which
 * answers "why can't I pick this" without a separate error.
 *
 * Everything else is a pill in the footer row, the same property-pill language
 * the new-task dialog uses.
 */
import { IconCloud, IconDeviceLaptop, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AgentMark } from "@/interactions/threads/components/agent-mark";
import {
  ACCESS_DETAIL,
  ACCESS_LABEL,
  addAgent,
  agentName,
  MEMBERS,
  ownerHasAgent,
  VIEWER,
  WORKSPACE_OWNER,
  type AgentAccess,
  type AgentRuntime,
} from "@/interactions/collaboration/data/collaboration.mock";
import { AGENTS, agentShort } from "@/interactions/threads/interfaces/agents";
import type { AgentKind } from "@byconvo/core/threads";
import { cn } from "@/lib/utils";

/** The plain shell is not something you add to a workspace as a teammate. */
const INSTALLABLE = AGENTS.filter((agent) => agent.kind !== "terminal");

const OWNERS = [VIEWER.name, ...MEMBERS.map((m) => m.name)];

const ACCESS_ORDER: ReadonlyArray<AgentAccess> = ["ask", "edits", "full"];

/**
 * Where the CLI actually runs decides who may call it later, so it is the
 * choice the dialog makes before it asks whose account it posts under.
 */
const RUNTIMES: ReadonlyArray<{
  value: AgentRuntime;
  label: string;
  detail: string;
}> = [
  {
    value: "local",
    label: "On a machine",
    detail: "Only its owner can bring it into a chat",
  },
  {
    value: "cloud",
    label: "In the workspace cloud",
    detail: "Anyone in the workspace can call it",
  },
];

function KindTile({
  kind,
  hint,
  selected,
  taken,
  onSelect,
}: {
  kind: AgentKind;
  hint: string;
  selected: boolean;
  taken: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={taken}
      aria-pressed={selected}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-start gap-2 rounded-xl border p-3 text-left outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/30",
        selected ? "border-foreground/25 bg-muted" : "hover:bg-elevate",
        taken && "pointer-events-none opacity-40"
      )}
    >
      <AgentMark kind={kind} className="size-8 rounded-lg" />
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-medium">
          {agentShort(kind)}
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {taken ? "already added" : hint}
        </span>
      </span>
    </button>
  );
}

function Pill({
  label,
  children,
  menu,
}: {
  label: string;
  children: React.ReactNode;
  menu: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" aria-label={label} />}
      >
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {menu}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AddAgentButton({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AgentKind>("claude");
  const [runtime, setRuntime] = useState<AgentRuntime>("local");
  const [person, setPerson] = useState(VIEWER.name);
  const [detail, setDetail] = useState("");
  const [access, setAccess] = useState<AgentAccess>("edits");

  // A cloud agent belongs to the workspace, so there is nobody to pick — the
  // owner pill drops out and the tiles are checked against the workspace.
  const owner = runtime === "cloud" ? WORKSPACE_OWNER : person;

  // Switching owner can make the current pick unavailable — rather than opening
  // on a disabled tile, the selection falls through to the first one free.
  const free = INSTALLABLE.filter((a) => !ownerHasAgent(owner, a.kind));
  const selected = ownerHasAgent(owner, kind) ? free[0]?.kind : kind;
  const ownerLabel = owner === VIEWER.name ? `${owner} (You)` : owner;
  const runtimeLabel =
    RUNTIMES.find((r) => r.value === runtime)?.label ?? RUNTIMES[0]?.label;

  const create = () => {
    if (selected === undefined) return;
    const agent = addAgent({ kind: selected, runtime, owner, detail, access });
    setOpen(false);
    setDetail("");
    void navigate({
      to: "/modes/collaboration",
      search: { view: "agents", id: agent.id },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          compact ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Add agent"
              className="size-5 text-muted-foreground"
            />
          ) : (
            <Button size="sm" className="py-1.5 pr-2.5 pl-1.5" />
          )
        }
      >
        <IconPlus className={compact ? "size-3.5" : "size-4"} />
        {!compact && "Add agent"}
      </DialogTrigger>

      <DialogContent className="gap-0 p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="px-4 pt-4 text-sm font-medium">
          Add an agent
        </DialogTitle>
        <DialogDescription className="px-4 pt-1 text-xs text-muted-foreground">
          It joins the workspace under someone&rsquo;s account and posts as
          theirs.
        </DialogDescription>

        <div className="flex gap-2 p-4">
          {INSTALLABLE.map((agent) => (
            <KindTile
              key={agent.kind}
              kind={agent.kind}
              hint={agent.hint}
              selected={agent.kind === selected}
              taken={ownerHasAgent(owner, agent.kind)}
              onSelect={() => setKind(agent.kind)}
            />
          ))}
        </div>

        <Input
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          name="detail"
          placeholder="What it is for — reviewing pull requests on atlas-ingest…"
          aria-label="What the agent is for"
          className="h-auto border-0 bg-transparent px-4 py-0 text-sm shadow-none focus-visible:ring-0"
        />

        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
          <Pill
            label="Runs"
            menu={RUNTIMES.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setRuntime(option.value)}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {option.detail}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          >
            {runtime === "cloud" ? (
              <IconCloud className="size-4 shrink-0" />
            ) : (
              <IconDeviceLaptop className="size-4 shrink-0" />
            )}
            <span className="truncate">{runtimeLabel}</span>
          </Pill>

          {runtime === "local" && (
            <Pill
              label="Runs as"
              menu={OWNERS.map((name) => (
                <DropdownMenuItem key={name} onClick={() => setPerson(name)}>
                  <Avatar name={name} className="size-5" />
                  {name === VIEWER.name ? `${name} (You)` : name}
                </DropdownMenuItem>
              ))}
            >
              <Avatar name={owner} className="size-4 text-[0.5rem]" />
              <span className="truncate">{ownerLabel}</span>
            </Pill>
          )}

          <Pill
            label="Access"
            menu={ACCESS_ORDER.map((value) => (
              <DropdownMenuItem key={value} onClick={() => setAccess(value)}>
                <span className="min-w-0">
                  <span className="block truncate">{ACCESS_LABEL[value]}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {ACCESS_DETAIL[value]}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          >
            <span className="truncate">{ACCESS_LABEL[access]}</span>
          </Pill>
        </div>

        <DialogFooter className="items-center border-t px-4 py-3">
          <p className="mr-auto min-w-0 truncate text-xs text-muted-foreground">
            {selected === undefined ? (
              `${ownerLabel.replace(" (You)", "")} runs every agent already.`
            ) : (
              <>
                Joins as{" "}
                <span className="font-medium text-foreground">
                  {agentName({
                    id: "",
                    kind: selected,
                    runtime,
                    owner,
                    detail: "",
                    access,
                    running: false,
                  })}
                </span>
              </>
            )}
          </p>
          <DialogClose render={<Button variant="ghost" size="sm" />}>
            Cancel
          </DialogClose>
          <Button size="sm" disabled={selected === undefined} onClick={create}>
            Add agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
