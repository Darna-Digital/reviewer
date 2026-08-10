/**
 * The agents a session can be handed to, and how to add another.
 *
 * The dialog teaches by showing: the CLIs already found on this machine are
 * listed with the exact command byconvo runs for each, and the form underneath
 * asks for the same two things — a name, and that command with `{prompt}` where
 * the prompt goes. Nothing here is a new concept; it is the existing bargain
 * written down.
 */
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AgentMark } from "@/interactions/threads/components/agent-mark";
import {
  nextAgentId,
  updateCustomAgents,
} from "@/interactions/session-agents/adapters/session-agents.store";
import {
  addCustomAgent,
  draftProblem,
  emptyDraft,
  removeCustomAgent,
  updateCustomAgent,
} from "@/interactions/session-agents/functions/session-agents.functions";
import {
  PROMPT_TOKEN,
  type AgentDraft,
  type SessionAgent,
} from "@/interactions/session-agents/interfaces/session-agents.interfaces";

function AgentRow({
  agent,
  onEdit,
  onRemove,
}: {
  agent: SessionAgent;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="group/agent flex items-center gap-2.5 py-2 pl-1 text-sm">
      <AgentMark kind={agent.kind} className="size-7 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{agent.name}</span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {agent.command}
        </span>
      </span>
      {agent.detected ? (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Detected
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 group-focus-within/agent:opacity-100 group-hover/agent:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${agent.name}`}
            onClick={onEdit}
          >
            <IconPencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${agent.name}`}
            onClick={onRemove}
          >
            <IconTrash className="size-4" />
          </Button>
        </span>
      )}
    </li>
  );
}

export function AgentManagerDialog({
  agents,
  open,
  onOpenChange,
}: {
  agents: ReadonlyArray<SessionAgent>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<AgentDraft>(emptyDraft);
  /** The agent the form is rewriting, or null while it is adding a new one. */
  const [editing, setEditing] = useState<string | null>(null);

  const problem = draftProblem(draft);
  const reset = () => {
    setDraft(emptyDraft());
    setEditing(null);
  };

  const save = () => {
    if (problem !== null) return;
    updateCustomAgents((current) =>
      editing === null
        ? addCustomAgent(current, draft, nextAgentId())
        : updateCustomAgent(current, editing, draft)
    );
    reset();
  };

  const edit = (agent: SessionAgent) => {
    setDraft({ name: agent.name, command: agent.command });
    setEditing(agent.id);
  };

  const remove = (agent: SessionAgent) => {
    updateCustomAgents((current) => removeCustomAgent(current, agent.id));
    if (editing === agent.id) reset();
  };

  const added = agents.filter((agent) => !agent.detected);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="px-4 pt-4 text-sm font-medium">
          Agents in this session
        </DialogTitle>
        <DialogDescription className="px-4 pt-1 text-xs text-muted-foreground">
          An agent is a command-line tool on this machine. Byconvo runs it with
          your prompt and reads back whatever it prints.
        </DialogDescription>

        <ul role="list" className="divide-y divide-border px-4 pt-3">
          {agents.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              onEdit={() => edit(agent)}
              onRemove={() => remove(agent)}
            />
          ))}
        </ul>

        {added.length === 0 && (
          <p className="px-4 pt-3 text-xs text-muted-foreground">
            Anything else that answers on the command line can join them.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 border-t px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">
            {editing === null ? "Add an agent" : "Edit agent"}
          </p>
          <Input
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            name="agent-name"
            aria-label="Agent name"
            placeholder="Reviewer"
          />
          <Input
            value={draft.command}
            onChange={(event) =>
              setDraft({ ...draft, command: event.target.value })
            }
            name="agent-command"
            aria-label="Command it runs"
            placeholder={`review run ${PROMPT_TOKEN}`}
            className="font-mono"
          />
          <div className="flex items-center gap-2">
            <p className="mr-auto min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {problem ?? (
                <>
                  Runs{" "}
                  <span className="font-mono">
                    {draft.command.replace(PROMPT_TOKEN, "your prompt")}
                  </span>
                </>
              )}
            </p>
            {editing !== null && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              className="py-1.5 pr-2.5 pl-1.5"
              disabled={problem !== null}
              onClick={save}
            >
              <IconPlus className="size-4" />
              {editing === null ? "Add agent" : "Save agent"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
