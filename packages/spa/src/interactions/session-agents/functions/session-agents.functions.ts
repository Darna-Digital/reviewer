/**
 * Transitions over the custom agents, and the strip they are shown in beside
 * the detected CLIs. All of it is decidable from a list and a draft, so none of
 * it needs a rendered dialog to test.
 */
import {
  agentHint,
  agentLabel,
} from "@/interactions/threads/interfaces/agents";
import type { AgentKind } from "@byconvo/core/threads";
import {
  PROMPT_TOKEN,
  type AgentDraft,
  type CustomAgent,
  type SessionAgent,
} from "../interfaces/session-agents.interfaces";

/** What a fresh row starts as — the shape of the bargain, ready to fill in. */
export const emptyDraft = (): AgentDraft => ({
  name: "",
  command: `run ${PROMPT_TOKEN}`,
});

/**
 * Why a draft cannot be saved yet, or null when it can. The command has to say
 * where the prompt goes: without the placeholder the agent would be run with
 * nothing to answer.
 */
export function draftProblem(draft: AgentDraft): string | null {
  if (draft.name.trim() === "") return "Give the agent a name.";
  if (draft.command.trim() === "") return "Give the agent a command to run.";
  if (!draft.command.includes(PROMPT_TOKEN)) {
    return `Put ${PROMPT_TOKEN} where the prompt should go.`;
  }
  return null;
}

export const canSaveDraft = (draft: AgentDraft): boolean =>
  draftProblem(draft) === null;

const trimmed = (draft: AgentDraft): AgentDraft => ({
  name: draft.name.trim(),
  command: draft.command.trim(),
});

export function addCustomAgent(
  agents: ReadonlyArray<CustomAgent>,
  draft: AgentDraft,
  id: string
): ReadonlyArray<CustomAgent> {
  if (!canSaveDraft(draft)) return agents;
  return [...agents, { id, ...trimmed(draft) }];
}

export function updateCustomAgent(
  agents: ReadonlyArray<CustomAgent>,
  id: string,
  draft: AgentDraft
): ReadonlyArray<CustomAgent> {
  if (!canSaveDraft(draft)) return agents;
  return agents.map((agent) =>
    agent.id === id ? { ...agent, ...trimmed(draft) } : agent
  );
}

export const removeCustomAgent = (
  agents: ReadonlyArray<CustomAgent>,
  id: string
): ReadonlyArray<CustomAgent> => agents.filter((agent) => agent.id !== id);

/**
 * The strip: every CLI the server found, then the ones added by hand. A
 * detected agent's command is the one byconvo already runs for it, so the two
 * halves of the list read as the same kind of thing.
 */
export function sessionAgents(
  detected: ReadonlyArray<AgentKind>,
  custom: ReadonlyArray<CustomAgent>
): ReadonlyArray<SessionAgent> {
  const added: ReadonlyArray<SessionAgent> = custom.map((agent) => ({
    id: agent.id,
    name: agent.name,
    command: agent.command,
    kind: "terminal",
    detected: false,
  }));
  return [
    ...detected.map((kind) => ({
      id: kind,
      name: agentLabel(kind),
      command: `${agentHint(kind)} ${PROMPT_TOKEN}`,
      kind,
      detected: true,
    })),
    ...added,
  ];
}
