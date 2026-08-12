import { Message } from "#/components/icons";
import { Avatar } from "#/components/showcase/avatar";

interface Card {
  readonly key: string;
  readonly title: string;
  readonly assignee?: string;
  readonly agent?: boolean;
  readonly done?: boolean;
}

const COLUMNS: ReadonlyArray<{
  title: string;
  cards: ReadonlyArray<Card>;
}> = [
  {
    title: "Up for grabs",
    cards: [
      { key: "T-31", title: "Split the diff worker pool per repository" },
      { key: "T-34", title: "Keyboard path through the branch menu" },
    ],
  },
  {
    title: "In progress",
    cards: [
      {
        key: "T-28",
        title: "Move the blank-body rule into comments.functions",
        assignee: "CC",
        agent: true,
      },
      {
        key: "T-29",
        title: "Landing page, built from real components",
        assignee: "RR",
      },
    ],
  },
  {
    title: "Done",
    cards: [
      {
        key: "T-22",
        title: "Project-relative language paths across repositories",
        assignee: "RR",
        done: true,
      },
    ],
  },
];

const MESSAGES = [
  {
    initials: "RR",
    author: "Rūtenis Raila",
    body: "T-28 is yours. The comment on comments.functions.ts:21 says what I want — read it before you start.",
  },
  {
    initials: "CC",
    author: "Claude",
    agent: true,
    body: "Read it. Guard moves into submit, test added. Opening a thread on task/comments-guard so you can review the diff before it lands.",
  },
];

export function CollaborationShowcase() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <div className="grid gap-3 rounded-xl border border-black/10 bg-neutral-50/70 p-3 shadow-xl shadow-black/5 sm:grid-cols-3">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <div className="flex items-center gap-2 px-1 pb-2">
              <span className="text-[11px] font-medium text-neutral-700">
                {column.title}
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                {column.cards.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {column.cards.map((card) => (
                <li
                  className="rounded-lg border border-black/8 bg-white p-2.5 shadow-sm"
                  key={card.key}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-neutral-400">
                      {card.key}
                    </span>
                    {card.assignee ? (
                      <span className="ml-auto flex items-center gap-1">
                        {card.agent ? (
                          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500">
                            agent
                          </span>
                        ) : null}
                        <Avatar
                          className="size-4 text-[8px]"
                          initials={card.assignee}
                        />
                      </span>
                    ) : (
                      <span className="ml-auto rounded-full border border-dashed border-black/15 px-1.5 py-0.5 text-[9px] text-neutral-400">
                        unassigned
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1.5 text-xs leading-snug ${card.done ? "text-neutral-400 line-through" : "text-neutral-800"}`}
                  >
                    {card.title}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5">
        <div className="flex items-center gap-2 border-b border-black/8 bg-neutral-50/70 px-3 py-2 text-[11px]">
          <Message className="size-3.5 text-neutral-400" />
          <span className="font-medium text-neutral-800">T-28</span>
          <span className="text-neutral-500">2 people · 1 agent</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-3">
          {MESSAGES.map((message) => (
            <div className="flex gap-2" key={message.author}>
              <Avatar initials={message.initials} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-neutral-800">
                    {message.author}
                  </span>
                  {message.agent ? (
                    <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-neutral-500">
                      agent
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-700">
                  {message.body}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-black/8 p-3">
          <div className="rounded-md border border-black/10 bg-neutral-50 px-2.5 py-2 text-[11px] text-neutral-400">
            Message the task…
          </div>
        </div>
      </div>
    </div>
  );
}
