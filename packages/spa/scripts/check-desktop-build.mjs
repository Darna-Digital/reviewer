/**
 * The desktop shell serves this build over a custom `byconvo://` scheme whose
 * catch-all hands any unknown path back to `_shell.html`, and the router
 * rewrites the address as you navigate. A document-relative asset URL therefore
 * resolves against whatever route is open: reloading on `/modes/code/branches`
 * asks for `/modes/code/assets/index-abc123.js`, gets HTML, and the window comes
 * up blank. Nothing catches that short of packaging the app and pressing ⌘R, so
 * catch it here instead.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const shellPath = resolve("dist/client/_shell.html")
const shell = readFileSync(shellPath, "utf8")

const relative = [...shell.matchAll(/(?:href|src)="(\.\.?\/[^"]*)"/g)].map(
  ([, url]) => url
)

if (relative.length > 0) {
  console.error(
    `${shellPath} references assets relative to the document, which breaks a ` +
      `reload on any route below the root:\n` +
      [...new Set(relative)].map((url) => `  ${url}`).join("\n") +
      `\n\nThe Vite \`base\` must stay "/" — see packages/spa/vite.config.ts.`
  )
  process.exit(1)
}
