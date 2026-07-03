import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { extname, join } from "node:path"

// Dropped images are decoded to temp files whose paths can be handed to local
// agent CLIs, matching native terminal drag-and-drop behavior.
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".avif",
])

/**
 * Decode a base64 image into a temp file and return its absolute path, or null
 * if it's too large or not a recognised image. Best-effort: any fs error yields
 * null so a bad drop never breaks the session.
 */
export const saveDroppedImage = (name: unknown, data: unknown): string | null => {
  if (typeof data !== "string" || data.length === 0) return null
  const rawName = typeof name === "string" ? name : ""
  const ext = extname(rawName).toLowerCase()
  if (!IMAGE_EXTS.has(ext)) return null
  let bytes: Buffer
  try {
    bytes = Buffer.from(data, "base64")
  } catch {
    return null
  }
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null
  try {
    const dir = join(tmpdir(), "byconvo-dropped")
    mkdirSync(dir, { recursive: true })
    const path = join(dir, `${randomUUID()}${ext}`)
    writeFileSync(path, bytes)
    return path
  } catch {
    return null
  }
}
