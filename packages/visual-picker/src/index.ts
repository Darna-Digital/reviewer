import { mount } from "./picker.ts"

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
])

const isLocal = () =>
  LOCAL_HOSTS.has(location.hostname) || location.hostname.endsWith(".localhost")

declare global {
  interface Window {
    __byconvoVisualPicker?: boolean
  }
}

const start = () => {
  if (!isLocal()) {
    console.warn(
      "[byconvo] visual picker is dev-only; skipping on",
      location.host
    )
    return
  }

  if (window.__byconvoVisualPicker === true) {
    console.warn("[byconvo] visual picker already loaded; skipping")
    return
  }

  window.__byconvoVisualPicker = true

  if (document.readyState !== "loading") {
    mount()
    return
  }

  document.addEventListener("DOMContentLoaded", mount, { once: true })
}

start()
