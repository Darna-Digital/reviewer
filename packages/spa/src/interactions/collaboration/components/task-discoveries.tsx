/**
 * What we found — the log of everything a task turned out to be.
 *
 * Estimating is close to impossible because the work is not knowable in
 * advance; what is knowable, afterwards, is what turned up. Recording that as
 * it happens costs one sentence and produces the only honest answer to "why is
 * this taking so long": here are the six things nobody knew about.
 *
 * A discovery does one of three things, and the difference matters. It splits
 * off work of its own, it makes this task bigger, or it turns something settled
 * back into a question — and that last one puts the task back into figuring
 * out, because it is no longer true that anybody knows what this is.
 */
import { IconArrowsSplit, IconHelpCircle, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  recordDiscovery,
  type DiscoveryEffect,
  type MockDiscovery,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";
import { cn } from "@/lib/utils";

const EFFECT_LABEL: Record<DiscoveryEffect, string> = {
  split: "split off work",
  grew: "made this bigger",
  question: "reopened a question",
};

const EFFECT_TONE: Record<DiscoveryEffect, string> = {
  split: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  grew: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  question: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const EFFECTS: ReadonlyArray<DiscoveryEffect> = ["grew", "split", "question"];

function Entry({ entry }: { entry: MockDiscovery }) {
  return (
    <li className="flex flex-col gap-1 border-l-2 py-1.5 pl-3">
      <p className="text-[13px] text-pretty">{entry.found}</p>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "rounded-full px-1.5 text-[0.6875rem]",
            EFFECT_TONE[entry.effect]
          )}
        >
          {EFFECT_LABEL[entry.effect]}
        </span>
        {entry.by} · {entry.when}
      </p>
    </li>
  );
}

export function TaskDiscoveries({ task }: { task: MockTask }) {
  const [found, setFound] = useState("");
  const [effect, setEffect] = useState<DiscoveryEffect>("grew");

  const record = () => {
    recordDiscovery(task.id, found, effect);
    setFound("");
    setEffect("grew");
  };

  return (
    <section className="mt-8 border-t pt-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">What we found</h2>
        {task.discoveries.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {task.discoveries.length}
          </span>
        )}
      </div>

      {task.discoveries.length > 0 ? (
        <ul role="list" className="mt-3 flex flex-col gap-2">
          {task.discoveries.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">
          Nothing has turned up yet that nobody knew about.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-1 rounded-xl border px-3 py-2">
        <Input
          value={found}
          onChange={(event) => setFound(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") record();
          }}
          placeholder="Found something nobody knew about…"
          aria-label="What you found"
          className="h-8 w-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex flex-wrap items-center gap-1">
          {EFFECTS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={effect === option}
              onClick={() => setEffect(option)}
              className={cn(
                "flex h-6 items-center gap-1 rounded-full px-2 text-[0.6875rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                effect === option
                  ? EFFECT_TONE[option]
                  : "text-muted-foreground hover:bg-elevate"
              )}
            >
              {option === "split" && <IconArrowsSplit className="size-3" />}
              {option === "question" && <IconHelpCircle className="size-3" />}
              {option === "grew" && <IconPlus className="size-3" />}
              {EFFECT_LABEL[option]}
            </button>
          ))}
          <Button
            size="sm"
            disabled={found.trim() === ""}
            onClick={record}
            className="ml-auto shrink-0"
          >
            Record
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Reopening a question puts this back into “figuring out”, because it is
        no longer true that anybody knows what this is.
      </p>
    </section>
  );
}
