/**
 * Drives the picker the way a person does — arm it, hover, click, type, save —
 * against a stubbed byconvo API, so the wiring is exercised without a browser.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mount } from "./picker.ts"

const HOST = "byconvo-visual-picker"

const shadow = () => {
  const host = document.getElementById(HOST)
  if (host?.shadowRoot == null) throw new Error("picker did not mount")
  return host.shadowRoot
}

const query = (selector: string) => shadow().querySelector(selector)

const armPicker = () =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "c", altKey: true, bubbles: true })
  )

const pressEscape = () =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  )

const hover = (target: Element) =>
  target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))

const click = (target: Element, init: MouseEventInit = {}) =>
  target.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, ...init })
  )

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

let posted: Array<{ url: string; body: any; method: string }>

beforeEach(async () => {
  posted = []
  localStorage.clear()
  document.getElementById(HOST)?.remove()
  document.body.innerHTML = `
    <main>
      <button id="save" class="btn btn-primary">Save changes</button>
      <button id="menu" aria-haspopup="menu">Open menu</button>
      <div id="menu-item" role="menuitem">Rename</div>
    </main>`
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      posted.push({
        url,
        method: init?.method ?? "GET",
        body: init?.body === undefined ? null : JSON.parse(String(init.body)),
      })
      const payload = init?.method === undefined ? [] : { ok: true }
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    })
  )
  mount()
  await flush()
})

describe("mount", () => {
  it("renders into a shadow root so the host page's CSS cannot reach it", () => {
    expect(shadow().querySelector(".launcher")).not.toBeNull()
  })

  it("is idempotent — a second injection does not stack a second overlay", () => {
    mount()
    expect(document.querySelectorAll(`#${HOST}`)).toHaveLength(1)
  })
})

describe("placement", () => {
  const launcher = () => query(".launcher") as HTMLElement
  const gear = () => query(".gear") as HTMLElement
  const option = (placement: string) =>
    query(`.settings-option[data-placement="${placement}"]`) as HTMLElement

  it("defaults to the bottom left, clear of framework dev indicators", () => {
    expect(launcher().dataset["placement"]).toBe("bottom-left")
    expect((query(".settings") as HTMLElement).hidden).toBe(true)
  })

  it("opens the settings menu from the gear", () => {
    gear().dispatchEvent(new MouseEvent("click", { bubbles: true }))

    expect((query(".settings") as HTMLElement).hidden).toBe(false)
    expect(option("bottom-left").dataset["active"]).toBe("true")
  })

  it("moves the widget to the chosen corner and marks it active", () => {
    gear().dispatchEvent(new MouseEvent("click", { bubbles: true }))
    option("top-right").dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    )

    expect(launcher().dataset["placement"]).toBe("top-right")
    expect(option("top-right").dataset["active"]).toBe("true")
    expect(option("bottom-left").dataset["active"]).toBe("false")
    expect((query(".settings") as HTMLElement).hidden).toBe(true)
  })

  it("remembers the choice for the next page load", () => {
    gear().dispatchEvent(new MouseEvent("click", { bubbles: true }))
    option("top-left").dispatchEvent(new MouseEvent("click", { bubbles: true }))

    expect(localStorage.getItem("byconvo-picker-placement")).toBe("top-left")
  })

  it("does not arm the picker when the gear is clicked", () => {
    gear().dispatchEvent(new MouseEvent("click", { bubbles: true }))

    expect(launcher().dataset["active"]).toBe("false")
  })
})

describe("entering and leaving comment mode", () => {
  const launcher = () => query(".launcher") as HTMLElement
  const label = () => query(".toggle-label") as HTMLElement
  const hint = () => query("kbd") as HTMLElement

  it("labels the launcher Comment / ⌥C while idle", () => {
    expect(label().textContent).toBe("Comment")
    expect(hint().textContent).toBe("⌥C")
    expect(launcher().dataset["active"]).toBe("false")
  })

  it("arms via ⌥C and shows Stop / Esc", () => {
    armPicker()

    expect(launcher().dataset["active"]).toBe("true")
    expect(label().textContent).toBe("Stop")
    expect(hint().textContent).toBe("Esc")
  })

  it("leaves picking with Escape", () => {
    armPicker()
    pressEscape()

    expect(launcher().dataset["active"]).toBe("false")
    expect(label().textContent).toBe("Comment")
  })

  it("steps composing → picking → idle on Escape", () => {
    const target = document.getElementById("save")!
    armPicker()
    hover(target)
    click(target)
    expect((query(".composer") as HTMLElement).hidden).toBe(false)

    pressEscape()
    expect((query(".composer") as HTMLElement).hidden).toBe(true)
    expect(launcher().dataset["active"]).toBe("true")

    pressEscape()
    expect(launcher().dataset["active"]).toBe("false")
  })

  it("toggles off via the launcher button", () => {
    armPicker()
    ;(query(".toggle") as HTMLElement).dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    )

    expect(launcher().dataset["active"]).toBe("false")
  })
})

describe("picking", () => {
  it("stays dormant until armed", () => {
    hover(document.getElementById("save")!)
    expect((query(".highlight") as HTMLElement).hidden).toBe(true)
  })

  it("shows the hovered node's tag, id and classes once armed", () => {
    armPicker()
    hover(document.getElementById("save")!)

    const badge = query(".badge") as HTMLElement
    expect(badge.hidden).toBe(false)
    expect(badge.querySelector(".tag")?.textContent).toBe("button")
    expect(badge.querySelector(".id")?.textContent).toBe("#save")
    expect(badge.querySelector(".cls")?.textContent).toBe(".btn.btn-primary")
  })

  it("swallows the click so the underlying app does not react to it", () => {
    const target = document.getElementById("save")!
    const appHandler = vi.fn()
    target.addEventListener("click", appHandler)

    armPicker()
    hover(target)
    click(target)

    expect(appHandler).not.toHaveBeenCalled()
    expect((query(".composer") as HTMLElement).hidden).toBe(false)
  })

  it("lets dropdown triggers open so their contents can be commented on", () => {
    const trigger = document.getElementById("menu")!
    const appHandler = vi.fn()
    trigger.addEventListener("click", appHandler)

    armPicker()
    hover(trigger)
    click(trigger)

    expect(appHandler).toHaveBeenCalled()
    expect((query(".composer") as HTMLElement).hidden).toBe(true)
  })

  it("picks items inside an open menu", () => {
    const item = document.getElementById("menu-item")!
    const appHandler = vi.fn()
    item.addEventListener("click", appHandler)

    armPicker()
    hover(item)
    click(item)

    expect(appHandler).not.toHaveBeenCalled()
    expect((query(".composer") as HTMLElement).hidden).toBe(false)
  })

  it("force-picks a dropdown trigger with shift-click", () => {
    const trigger = document.getElementById("menu")!
    const appHandler = vi.fn()
    trigger.addEventListener("click", appHandler)

    armPicker()
    hover(trigger)
    click(trigger, { shiftKey: true })

    expect(appHandler).not.toHaveBeenCalled()
    expect((query(".composer") as HTMLElement).hidden).toBe(false)
  })
})

describe("pins", () => {
  const comment = {
    id: "v-1",
    body: "Make this primary",
    author: "you",
    createdAt: "2026-01-01T00:00:00.000Z",
    pageUrl: "http://localhost/",
    pageTitle: "app",
    route: location.pathname,
    selector: "#save",
    label: 'button#save "Save changes"',
    tagName: "button",
    elementText: "Save changes",
    elementHtml: "<button>Save changes</button>",
    rect: { x: 0, y: 0, width: 10, height: 10 },
    viewport: { width: 1024, height: 768 },
  }

  beforeEach(async () => {
    document.getElementById(HOST)?.remove()
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        posted.push({
          url,
          method: init?.method ?? "GET",
          body: init?.body === undefined ? null : JSON.parse(String(init.body)),
        })
        const payload = init?.method === undefined ? [comment] : { ok: true }
        return Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        )
      })
    )
    mount()
    await flush()
  })

  it("renders each comment as a focusable button named after its body", () => {
    const pin = query(".pin") as HTMLButtonElement
    expect(pin.tagName).toBe("BUTTON")
    expect(pin.getAttribute("aria-label")).toBe("Comment 1: Make this primary")
    expect(pin.textContent).toBe("1")
  })

  it("opens the comment card from a pin and resolves it", async () => {
    ;(query(".pin") as HTMLElement).click()

    const card = query(".card") as HTMLElement
    expect(card.hidden).toBe(false)
    expect(card.textContent).toContain("Make this primary")

    const resolve = card.querySelector("button") as HTMLButtonElement
    expect(shadow().activeElement).toBe(resolve)
    resolve.click()
    await flush()

    const deleted = posted.find((call) => call.method === "DELETE")
    expect(deleted?.url).toContain("/api/visual-comments/v-1")
    expect(card.hidden).toBe(true)
  })

  it("closes an open card with Escape without leaving pins behind", () => {
    ;(query(".pin") as HTMLElement).click()
    expect((query(".card") as HTMLElement).hidden).toBe(false)

    pressEscape()

    expect((query(".card") as HTMLElement).hidden).toBe(true)
    expect(query(".pin")).not.toBeNull()
  })
})

describe("saving", () => {
  const compose = (body: string) => {
    const target = document.getElementById("save")!
    armPicker()
    hover(target)
    click(target)
    const textarea = query("textarea") as HTMLTextAreaElement
    textarea.value = body
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
      })
    )
  }

  it("posts the comment with the element captured as its anchor", async () => {
    compose("Make this primary")
    await flush()

    const post = posted.find((call) => call.method === "POST")
    expect(post).toBeDefined()
    expect(post!.url).toContain("/api/visual-comments")
    expect(post!.body).toMatchObject({
      body: "Make this primary",
      tagName: "button",
      elementText: "Save changes",
      route: location.pathname,
    })
    expect(post!.body.selector).toContain("#save")
    expect(post!.body.label).toContain(
      'button#save.btn.btn-primary "Save changes"'
    )
  })

  it("ignores an empty comment rather than posting a blank one", async () => {
    compose("   ")
    await flush()

    expect(posted.filter((call) => call.method === "POST")).toHaveLength(0)
  })

  it("saves a comment anchored to a menu item", async () => {
    const item = document.getElementById("menu-item")!
    armPicker()
    hover(item)
    click(item)
    const textarea = query("textarea") as HTMLTextAreaElement
    textarea.value = "Rename should be clearer"
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        metaKey: true,
        bubbles: true,
      })
    )
    await flush()

    const post = posted.find((call) => call.method === "POST")
    expect(post!.body).toMatchObject({
      body: "Rename should be clearer",
      tagName: "div",
      elementText: "Rename",
    })
  })
})
