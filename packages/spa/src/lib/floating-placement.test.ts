import { describe, expect, it } from "vitest"
import { placeCard } from "./floating-placement"

const VIEWPORT = { width: 1000, height: 600 }
const CARD = { width: 320, height: 200 }
const token = (top: number, left: number, height = 18) => ({
  top,
  bottom: top + height,
  left,
})

describe("placeCard", () => {
  it("sits just below the token when there is room", () => {
    expect(placeCard(token(100, 200), CARD, VIEWPORT)).toEqual({
      top: 124,
      left: 200,
      side: "below",
    })
  })

  it("flips above when the card would run off the bottom", () => {
    const placement = placeCard(token(500, 200), CARD, VIEWPORT)
    expect(placement.side).toBe("above")
    expect(placement.top).toBe(500 - 6 - 200)
  })

  it("stays below when neither side fits, so the token is not covered", () => {
    const cramped = { width: 1000, height: 220 }
    const placement = placeCard(token(100, 200), CARD, cramped)
    expect(placement.side).toBe("below")
    // Clamped up so the card's bottom keeps its margin: 220 - 200 - 8.
    expect(placement.top).toBe(12)
  })

  it("clamps against the right edge", () => {
    expect(placeCard(token(100, 950), CARD, VIEWPORT).left).toBe(1000 - 320 - 8)
  })

  it("clamps against the left edge", () => {
    expect(placeCard(token(100, -40), CARD, VIEWPORT).left).toBe(8)
  })

  it("keeps a card wider than the viewport at the left margin", () => {
    expect(
      placeCard(token(100, 200), { width: 2000, height: 100 }, VIEWPORT).left
    ).toBe(8)
  })

  it("prefers below when a token near the top has no room above", () => {
    const placement = placeCard(token(4, 200), CARD, VIEWPORT)
    expect(placement.side).toBe("below")
    expect(placement.top).toBe(28)
  })
})
