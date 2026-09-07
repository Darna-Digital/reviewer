// @vitest-environment jsdom
/**
 * The hover card's one job that is not about hovering: staying out of the way
 * of a comment being written.
 *
 * The card is drawn against the token the pointer is over, and a composer opens
 * as an annotation under that very line — so documentation nobody asked for
 * lands on top of the box being typed into. The layer is asked not to, and what
 * that has to mean is that nothing is even requested: a card that is fetched
 * and then thrown away still costs a round trip per token the pointer crosses.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TokenEventBase } from "@pierre/diffs";
import { useLanguageLayer } from "./language-layer";

const describeSymbol = vi.fn(async () => ({
  providerId: "typescript",
  range: null,
  contents: "**the symbol**",
}));

vi.mock("../adapters/language.hook.adapter", () => ({
  useDiagnostics: () => ({ data: { diagnostics: [] } }),
  useLanguageActions: () => ({
    diagnosticsByLine: () => new Map(),
    markerFor: () => null,
    counts: () => ({ errors: 0, warnings: 0, hints: 0 }),
    navigate: vi.fn(),
    describe: describeSymbol,
  }),
  forgetHovers: () => undefined,
}));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));

// Handing a search to the usages window is a whole surface away, and importing
// it pulls in the stored UI preferences and the browser they read.
vi.mock("@/interactions/find-usages/adapters/find-usages.store", () => ({
  findUsages: vi.fn(),
}));

// Both hang off the same layer and neither is what these tests are about.
vi.mock("./use-completions", () => ({
  useCompletions: () => ({ popup: null, viewOptions: {} }),
}));
vi.mock("./use-symbol-menu", () => ({
  useSymbolMenu: () => ({ menu: null }),
}));

/** The pointer arriving on a token, as the view reports it. */
const tokenEvent = (): TokenEventBase =>
  ({
    lineNumber: 1,
    lineCharStart: 6,
    lineCharEnd: 14,
    tokenText: "greeting",
    tokenElement: document.createElement("span"),
  }) as unknown as TokenEventBase;

let enter: (props: TokenEventBase) => void;
let leave: () => void;

function Harness({ hoverEnabled }: { readonly hoverEnabled: boolean }) {
  const layer = useLanguageLayer({
    path: "src/a.ts",
    editor: null,
    hoverEnabled,
    getContainer: () => document.body,
    onOpenLocation: () => undefined,
  });
  enter = layer.viewOptions.onTokenEnter;
  leave = layer.viewOptions.onTokenLeave;
  return <>{layer.card}</>;
}

/** Rest the pointer on a token for longer than the hover delay. */
const restOnToken = async () => {
  act(() => enter(tokenEvent()));
  await act(async () => {
    vi.advanceTimersByTime(1_000);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  describeSymbol.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/** Whether the card is on screen — it is rendered in a portal. */
const cardIsOpen = () => document.querySelector("[data-symbol-card]") !== null;

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe("hover documentation", () => {
  it("opens on a token the pointer rests on", async () => {
    render(<Harness hoverEnabled />);
    await restOnToken();
    expect(describeSymbol).toHaveBeenCalledWith("src/a.ts", expect.anything());
  });

  it("stays up long enough for the pointer to reach it", async () => {
    render(<Harness hoverEnabled />);
    await restOnToken();
    expect(cardIsOpen()).toBe(true);

    // The pointer sets off for the card, crossing the gap below the token.
    act(() => leave());
    await advance(400);
    // Half a second is the hand's; a sixth of one was not, and a card carrying
    // a link to a definition was gone before it could be clicked.
    expect(cardIsOpen()).toBe(true);

    // Not reached: it goes, as it should.
    await advance(200);
    expect(cardIsOpen()).toBe(false);
  });

  it("is not offered while a comment is being written on the file", async () => {
    render(<Harness hoverEnabled={false} />);
    await restOnToken();
    // Not asked for, so nothing to draw over the composer and no request made.
    expect(describeSymbol).not.toHaveBeenCalled();
  });
});
