import { describe, expect, it } from "vitest"
import { createPickModeFunctions } from "./pick-mode.functions.ts"
import { createPickModeDependenciesMock } from "./pick-mode.functions.mock.ts"

describe("PickMode functions", () => {
  const functions = createPickModeFunctions(createPickModeDependenciesMock())

  describe("reduceMode", () => {
    it("enters picking from idle on toggle", () => {
      expect(functions.reduceMode("idle", "toggle")).toBe("picking")
    })

    it("leaves to idle from picking or composing on toggle", () => {
      expect(functions.reduceMode("picking", "toggle")).toBe("idle")
      expect(functions.reduceMode("composing", "toggle")).toBe("idle")
    })

    it("steps composing → picking → idle on escape", () => {
      expect(functions.reduceMode("composing", "escape")).toBe("picking")
      expect(functions.reduceMode("picking", "escape")).toBe("idle")
      expect(functions.reduceMode("idle", "escape")).toBe("idle")
    })

    it("opens the composer only while picking", () => {
      expect(functions.reduceMode("picking", "pick")).toBe("composing")
      expect(functions.reduceMode("idle", "pick")).toBe("idle")
      expect(functions.reduceMode("composing", "pick")).toBe("composing")
    })

    it("returns to picking after a save", () => {
      expect(functions.reduceMode("composing", "saved")).toBe("picking")
    })
  })

  describe("resolveClickIntent", () => {
    it("ignores clicks outside picking mode", () => {
      expect(
        functions.resolveClickIntent({
          mode: "idle",
          isHost: false,
          shiftKey: false,
          isOverlayTrigger: false,
        })
      ).toBe("ignore")
    })

    it("ignores clicks on the picker host", () => {
      expect(
        functions.resolveClickIntent({
          mode: "picking",
          isHost: true,
          shiftKey: false,
          isOverlayTrigger: false,
        })
      ).toBe("ignore")
    })

    it("lets overlay triggers open so dropdowns can be commented on", () => {
      expect(
        functions.resolveClickIntent({
          mode: "picking",
          isHost: false,
          shiftKey: false,
          isOverlayTrigger: true,
        })
      ).toBe("pass")
    })

    it("picks ordinary elements", () => {
      expect(
        functions.resolveClickIntent({
          mode: "picking",
          isHost: false,
          shiftKey: false,
          isOverlayTrigger: false,
        })
      ).toBe("pick")
    })

    it("force-picks overlay triggers with shift", () => {
      expect(
        functions.resolveClickIntent({
          mode: "picking",
          isHost: false,
          shiftKey: true,
          isOverlayTrigger: true,
        })
      ).toBe("pick")
    })
  })

  describe("isOverlayTrigger", () => {
    it("detects aria-haspopup, data-slot triggers, summary and select", () => {
      document.body.innerHTML = `
        <button id="menu" aria-haspopup="menu">Open</button>
        <button id="slot" data-slot="dropdown-menu-trigger">Open</button>
        <details><summary id="sum">More</summary></details>
        <select id="sel"><option>A</option></select>
        <button id="plain">Plain</button>
        <div id="item" role="menuitem">Item</div>
      `

      expect(functions.isOverlayTrigger(document.getElementById("menu")!)).toBe(
        true
      )
      expect(functions.isOverlayTrigger(document.getElementById("slot")!)).toBe(
        true
      )
      expect(functions.isOverlayTrigger(document.getElementById("sum")!)).toBe(
        true
      )
      expect(functions.isOverlayTrigger(document.getElementById("sel")!)).toBe(
        true
      )
      expect(
        functions.isOverlayTrigger(document.getElementById("plain")!)
      ).toBe(false)
      expect(functions.isOverlayTrigger(document.getElementById("item")!)).toBe(
        false
      )
    })
  })

  describe("launcher chrome", () => {
    it("labels idle as Comment and active as Stop", () => {
      expect(functions.launcherLabel("idle")).toBe("Comment")
      expect(functions.launcherLabel("picking")).toBe("Stop")
      expect(functions.launcherLabel("composing")).toBe("Stop")
    })

    it("hints ⌥C to enter and Esc to leave", () => {
      expect(functions.launcherHint("idle")).toBe("⌥C")
      expect(functions.launcherHint("picking")).toBe("Esc")
      expect(functions.launcherHint("composing")).toBe("Esc")
    })
  })
})
