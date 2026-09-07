/**
 * What a session is for. Build is the ordinary conversation; analysis asks the
 * agent to record its answer in the Plans pane instead of only saying it.
 *
 * The mode is the composer's, not the server's: it decides what gets sent, so a
 * session that has drawn one analysis can be switched back to building without
 * anything about the thread having to change.
 */
export const CHAT_MODES = ["build", "analysis"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

/** The prompt handed to an agent asked to work an analysis out. */
export const buildAnalysisPrompt = (question: string): string =>
  [
    `Work out and record an analysis in reviewer's Plans pane: ${question.trim()}`,
    "",
    "Read the code first — do not guess at the flow. Then POST the analysis to",
    "`/api/plans` on the reviewer server (see the reviewer-plans skill for the",
    "schema). Lay the nodes out across the layers in the order the request",
    "actually travels — `frontend` through `transport` to `backend` and `data` —",
    "give every node an `anchor` of the file and line it stands for, and leave an",
    "annotation at each place a reader would otherwise have to go digging.",
    "",
    "Write an annotation that makes more than one point as a numbered list, one",
    "point per item — the pane renders the notes as markdown, and a wall of",
    "findings welded into two sentences is unreadable.",
  ].join("\n");

/** The title the generated analysis is filed under. */
export const buildAnalysisTitle = (question: string): string => {
  const cleaned = question.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return "Analysis";
  const titled = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return titled.length > 60 ? `${titled.slice(0, 60)}…` : titled;
};

/**
 * What actually goes to the agent. Analysis mode carries its instructions on
 * every send rather than only the first: a follow-up in an analysis session is
 * another pass at the drawing, and the agent has to be told to post the result
 * again for it to land in the pane.
 */
export const modePrompt = (mode: ChatMode, text: string): string =>
  mode === "analysis" ? buildAnalysisPrompt(text) : text;

/** The title a session opened in `mode` is filed under, or null to let the
 * server name it from the prompt. */
export const modeTitle = (mode: ChatMode, text: string): string | null =>
  mode === "analysis" ? buildAnalysisTitle(text) : null;
