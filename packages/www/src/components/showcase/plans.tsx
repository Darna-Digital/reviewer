import { PaneHeader } from "#/components/app-window";
import { Document } from "#/components/icons";
import { Avatar } from "#/components/showcase/avatar";

const LANES = [
  { label: "Frontend", x: 16 },
  { label: "Backend", x: 330 },
  { label: "Data", x: 644 },
];

const NODES = [
  {
    x: 32,
    y: 96,
    kind: "ui",
    label: "CommentComposer",
    summary: "Submits the body typed on the picked line",
    anchor: "comments/components/comment-thread.tsx:96",
    marker: "1",
  },
  {
    x: 346,
    y: 40,
    kind: "service",
    label: "comments.service",
    summary: "Decides which store the comment lands in",
    anchor: "core/features/comments/service:41",
    marker: "2",
  },
  {
    x: 346,
    y: 152,
    kind: "external",
    label: "git-provider",
    summary: "Anchors the reply to its parent line on the PR",
    anchor: "core/ports/git-provider.ts:88",
    marker: "3",
  },
  {
    x: 660,
    y: 96,
    kind: "store",
    label: ".byconvo/comments.json",
    summary: "Worktree store, committed with the code",
    anchor: "embedded-server/repository:24",
  },
];

const EDGES = [
  {
    path: "M220,132 C272,132 296,76 346,76",
    label: "POST /api/comments",
    labelX: 283,
    labelY: 96,
    anchor: "middle" as const,
  },
  {
    path: "M534,76 C586,76 610,132 660,132",
    label: "append",
    labelX: 597,
    labelY: 96,
    anchor: "middle" as const,
  },
  {
    path: "M440,112 L440,152",
    label: "when reviewing a PR",
    labelX: 450,
    labelY: 136,
    anchor: "start" as const,
  },
];

const KIND_TONE: Record<string, { fill: string; text: string }> = {
  ui: { fill: "#eef2fb", text: "#31518c" },
  service: { fill: "#eef6f0", text: "#2b6b45" },
  external: { fill: "#fbf1ea", text: "#9a4a25" },
  store: { fill: "#f3eefb", text: "#5b3d8c" },
};

const ANCHOR_STATUS = {
  fresh: { label: "fresh", className: "bg-[#e6f2ea] text-[#2b6b45]" },
  relocated: {
    label: "moved to :112",
    className: "bg-[#fdf3dc] text-[#8a6516]",
  },
  lost: { label: "line gone", className: "bg-[#fbe9e7] text-[#b3261e]" },
} as const;

const ANNOTATIONS = [
  {
    marker: "1",
    author: "Claude",
    initials: "CC",
    body: "A blank body never reaches the server — the composer no-ops before it calls submit.",
    anchor: "comment-thread.tsx:96",
    status: "fresh",
  },
  {
    marker: "2",
    author: "Claude",
    initials: "CC",
    body: "Local and PR comments diverge here, and nowhere else. Everything downstream reads one shape.",
    anchor: "comments.service.ts:41",
    status: "relocated",
  },
  {
    marker: "3",
    author: "Rūtenis Raila",
    initials: "RR",
    body: "Replies stopped carrying the parent line when we moved to the ports package — recheck.",
    anchor: "git-provider.ts:88",
    status: "lost",
  },
] as const;

export function PlansShowcase() {
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/5">
      <PaneHeader
        actions={
          <>
            <span>4 nodes</span>
            <span>3 notes</span>
            <span className="rounded-full bg-[#fbe9e7] px-2 py-0.5 text-[10px] font-medium text-[#b3261e]">
              1 anchor lost
            </span>
          </>
        }
      >
        <Document className="size-3.5 text-neutral-400" />
        <span className="font-medium text-neutral-800">
          How does a review comment reach the pull request?
        </span>
      </PaneHeader>

      <svg
        className="w-full"
        viewBox="0 0 880 250"
        role="img"
        aria-label="Flow graph from the comment composer through the service to the comment store"
      >
        {LANES.map((lane) => (
          <g key={lane.label}>
            <rect
              x={lane.x}
              y={26}
              width={220}
              height={210}
              rx={10}
              fill="#fafafa"
              stroke="#00000010"
            />
            <text
              x={lane.x + 4}
              y={16}
              fill="#a3a3a3"
              fontSize={9}
              letterSpacing={1.2}
              fontFamily="ui-monospace, monospace"
            >
              {lane.label.toUpperCase()}
            </text>
          </g>
        ))}

        {EDGES.map((edge) => (
          <g key={edge.label}>
            <path
              d={edge.path}
              fill="none"
              stroke="#c4c4c4"
              strokeWidth={1.25}
              strokeDasharray="3 3"
            />
            <text
              x={edge.labelX}
              y={edge.labelY}
              textAnchor={edge.anchor}
              fill="#8a8a8a"
              fontSize={9.5}
              fontFamily="ui-monospace, monospace"
            >
              {edge.label}
            </text>
          </g>
        ))}

        {NODES.map((node) => {
          const tone = KIND_TONE[node.kind];
          return (
            <g key={node.label}>
              <rect
                x={node.x}
                y={node.y}
                width={188}
                height={72}
                rx={8}
                fill="#ffffff"
                stroke="#00000018"
              />
              <rect
                x={node.x + 10}
                y={node.y + 10}
                width={node.kind.length * 5.5 + 12}
                height={14}
                rx={7}
                fill={tone.fill}
              />
              <text
                x={node.x + 16}
                y={node.y + 20}
                fill={tone.text}
                fontSize={8.5}
                fontFamily="ui-monospace, monospace"
              >
                {node.kind}
              </text>
              <text
                x={node.x + 10}
                y={node.y + 40}
                fill="#171717"
                fontSize={11.5}
                fontWeight={600}
              >
                {node.label}
              </text>
              <text x={node.x + 10} y={node.y + 54} fill="#737373" fontSize={9}>
                {node.summary}
              </text>
              <text
                x={node.x + 10}
                y={node.y + 66}
                fill="#a3a3a3"
                fontSize={8.5}
                fontFamily="ui-monospace, monospace"
              >
                {node.anchor}
              </text>
              {node.marker ? (
                <>
                  <circle
                    cx={node.x + 176}
                    cy={node.y + 14}
                    r={7}
                    fill="#171717"
                  />
                  <text
                    x={node.x + 176}
                    y={node.y + 17.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={8.5}
                    fontWeight={600}
                  >
                    {node.marker}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>

      <ul className="grid gap-px border-t border-black/8 bg-black/8 sm:grid-cols-3">
        {ANNOTATIONS.map((note) => {
          const status = ANCHOR_STATUS[note.status];
          return (
            <li className="bg-white p-4" key={note.marker}>
              <div className="flex items-center gap-2">
                <span className="grid size-4 place-items-center rounded-full bg-neutral-900 text-[9px] font-semibold text-white">
                  {note.marker}
                </span>
                <Avatar
                  className="size-4 text-[8px]"
                  initials={note.initials}
                />
                <span className="text-[11px] font-medium text-neutral-800">
                  {note.author}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-700">
                {note.body}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-neutral-400">
                  {note.anchor}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
