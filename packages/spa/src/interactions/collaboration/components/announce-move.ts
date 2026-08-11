/**
 * What a move cost, said out loud.
 *
 * Pulling something into a full horizon pushes the tail of it further out, and
 * that consequence is the whole reason this model exists — so it is announced
 * rather than absorbed quietly, with the way back one click away.
 */
import { toast } from "sonner";
import {
  findScope,
  undoLastMove,
} from "@/interactions/collaboration/data/collaboration.mock";
import type { Displacement } from "@/interactions/collaboration/functions/task-flow.functions";

const scopeName = (id: string) => findScope(id)?.name ?? "no horizon";

export function announceMove(displaced: ReadonlyArray<Displacement>): void {
  const first = displaced[0];
  if (first === undefined) return;
  toast(`${scopeName(first.from)} was full — something had to give`, {
    description: displaced
      .map(
        (move) => `${move.task.key} ${move.task.title} → ${scopeName(move.to)}`
      )
      .join(" · "),
    action: { label: "Undo", onClick: () => undoLastMove() },
  });
}
