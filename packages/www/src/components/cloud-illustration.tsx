/**
 * Reviewer Cloud has no screenshot yet. This draws what it adds to the local
 * apps: one review, with its diff and comments, shared between your tools on
 * the left (the Mac app, the terminal app, an agent) and your team on the
 * right. It sits on the same noir backdrop and in the same frame as the
 * terminal app's captures, so the homepage stage keeps its size.
 */

type Row = "ctx" | "add" | "del";

const ROWS: { kind: Row; width: number }[] = [
  { kind: "ctx", width: 220 },
  { kind: "ctx", width: 300 },
  { kind: "del", width: 260 },
  { kind: "add", width: 290 },
  { kind: "add", width: 180 },
  { kind: "ctx", width: 120 },
  { kind: "ctx", width: 250 },
  { kind: "del", width: 210 },
  { kind: "add", width: 320 },
  { kind: "add", width: 240 },
  { kind: "add", width: 150 },
];

const PANEL = { x: 380, y: 137, width: 440, height: 458 };
const ROW_TOP = 214;
const ROW_STEP = 28;
// The comment opens under this row, as it does in the apps.
const COMMENT_AFTER = 4;

const LINE = "rgba(255,255,255,0.16)";
const EDGE = "rgba(255,255,255,0.14)";

function rowY(index: number) {
  return ROW_TOP + index * ROW_STEP + (index > COMMENT_AFTER ? 72 : 0);
}

function Node({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x - 40} ${y - 40})`}>
      <rect
        fill="rgba(255,255,255,0.05)"
        height="80"
        rx="20"
        stroke={EDGE}
        width="80"
      />
      <g
        fill="none"
        stroke="rgba(255,255,255,0.75)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        transform="translate(40 40)"
      >
        {children}
      </g>
    </g>
  );
}

function Person({ x, y }: { x: number; y: number }) {
  return (
    <Node x={x} y={y}>
      <circle cy="-7" r="7" />
      <path d="M-13 15c1.5-8 7-12 13-12s11.5 4 13 12" />
    </Node>
  );
}

/** A curve from a node's edge to the panel's, with a dot where it lands. */
function Link({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <path
        d={`M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
        fill="none"
        stroke={LINE}
        strokeDasharray="2 7"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx={x2} cy={y2} fill="rgba(255,255,255,0.5)" r="3.5" />
    </g>
  );
}

export function CloudIllustration() {
  const left = [196, 366, 536];
  const right = [251, 481];
  const panelRight = PANEL.x + PANEL.width;

  return (
    <div className="noir px-[5%] pt-[4.5%] pb-[5%]">
      <svg
        aria-label="One review, with its diff and a comment, shared between the Mac app, the terminal app, an agent and two teammates"
        className="block h-auto w-full"
        role="img"
        viewBox="0 0 1200 732"
      >
        {left.map((y, index) => (
          <Link
            from={[190, y]}
            key={y}
            to={[PANEL.x, PANEL.y + 120 + index * 110]}
          />
        ))}
        {right.map((y, index) => (
          <Link
            from={[1010, y]}
            key={y}
            to={[panelRight, PANEL.y + 160 + index * 150]}
          />
        ))}

        {/* Your tools: the Mac app, the terminal app and an agent. */}
        <Node x={150} y={left[0]}>
          <rect height="18" rx="2.5" width="28" x="-14" y="-12" />
          <path d="M-18 11h36" />
        </Node>
        <Node x={150} y={left[1]}>
          <rect height="26" rx="4" width="32" x="-16" y="-13" />
          <path d="m-9 -4 5 4-5 4M1 5h7" />
        </Node>
        <Node x={150} y={left[2]}>
          <path d="M0-15c1.5 9 6 13.5 15 15-9 1.5-13.5 6-15 15-1.5-9-6-13.5-15-15 9-1.5 13.5-6 15-15Z" />
        </Node>

        {/* Your team. */}
        <Person x={1050} y={right[0]} />
        <Person x={1050} y={right[1]} />

        {/* The shared review. */}
        <rect
          fill="#0c0c0c"
          height={PANEL.height}
          rx="18"
          stroke="rgba(255,255,255,0.2)"
          width={PANEL.width}
          x={PANEL.x}
          y={PANEL.y}
        />
        <path d={`M${PANEL.x} ${PANEL.y + 46}h${PANEL.width}`} stroke={EDGE} />
        {[0, 1, 2].map((dot) => (
          <circle
            cx={PANEL.x + 24 + dot * 18}
            cy={PANEL.y + 23}
            fill="rgba(255,255,255,0.22)"
            key={dot}
            r="5"
          />
        ))}
        <rect
          fill="rgba(255,255,255,0.22)"
          height="8"
          rx="4"
          width="120"
          x={PANEL.x + 160}
          y={PANEL.y + 19}
        />

        {ROWS.map(({ kind, width }, index) => {
          const y = rowY(index);
          return (
            <g key={index}>
              {kind !== "ctx" && (
                <rect
                  fill={
                    kind === "add"
                      ? "rgba(255,255,255,0.07)"
                      : "rgba(255,255,255,0.025)"
                  }
                  height={ROW_STEP}
                  width={PANEL.width - 2}
                  x={PANEL.x + 1}
                  y={y - ROW_STEP / 2}
                />
              )}
              <rect
                fill="rgba(255,255,255,0.14)"
                height="6"
                rx="3"
                width="16"
                x={PANEL.x + 20}
                y={y - 3}
              />
              {kind !== "ctx" && (
                <path
                  d={
                    kind === "add"
                      ? `M${PANEL.x + 50} ${y}h10M${PANEL.x + 55} ${y - 5}v10`
                      : `M${PANEL.x + 50} ${y}h10`
                  }
                  stroke={
                    kind === "add"
                      ? "rgba(255,255,255,0.8)"
                      : "rgba(255,255,255,0.3)"
                  }
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              )}
              <rect
                fill={
                  kind === "add"
                    ? "rgba(255,255,255,0.6)"
                    : kind === "del"
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(255,255,255,0.25)"
                }
                height="8"
                rx="4"
                width={width}
                x={PANEL.x + 76}
                y={y - 4}
              />
            </g>
          );
        })}

        {/* A comment on the line above it. */}
        <g transform={`translate(${PANEL.x + 64} ${rowY(COMMENT_AFTER) + 22})`}>
          <rect
            fill="#161616"
            height="56"
            rx="12"
            stroke="rgba(255,255,255,0.28)"
            width="340"
          />
          <circle cx="26" cy="28" fill="rgba(255,255,255,0.3)" r="11" />
          <rect
            fill="rgba(255,255,255,0.55)"
            height="7"
            rx="3.5"
            width="90"
            x="48"
            y="17"
          />
          <rect
            fill="rgba(255,255,255,0.25)"
            height="7"
            rx="3.5"
            width="250"
            x="48"
            y="32"
          />
        </g>
      </svg>
    </div>
  );
}
