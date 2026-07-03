/**
 * Composer image attachments. A picked/pasted/dropped image is read into two
 * forms: the full-resolution base64 `data` handed to the agent (decoded to a
 * temp file server-side, see features/chats/runtime/chat-runtime.ts) and a
 * small `thumbnail` data-URL used for the composer chip and, once sent, the
 * persisted timeline preview. Mirrors the terminal drag-and-drop reader
 * (lib/terminal/image-drop.ts) but produces a preview instead of a wire frame.
 */

/** Reject anything larger than this before reading it into memory. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024

/** Longest edge of the generated preview thumbnail, in pixels. */
const THUMBNAIL_MAX_EDGE = 512

/** What the agent receives + what the message keeps for its preview. */
export interface ChatImagePayload {
  readonly name: string
  /** Raw base64 (no `data:` prefix) of the full-resolution image. */
  readonly data: string
  /** A small `data:` URL thumbnail. */
  readonly thumbnail: string
}

/** A pending attachment held by the composer before it is sent. */
export interface ComposerAttachment extends ChatImagePayload {
  readonly id: string
}

export const isImageFile = (file: File): boolean =>
  file.type.startsWith("image/")

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error("read failed"))
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
  })

const stripDataUrlPrefix = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(",")
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

/**
 * Downscale `dataUrl` to a small JPEG data-URL for the preview. Falls back to
 * the original data-URL if the image can't be drawn (so a preview always
 * shows) — the full-resolution copy the agent reads is untouched either way.
 */
const makeThumbnail = (dataUrl: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(
        1,
        THUMBNAIL_MAX_EDGE / Math.max(img.width, img.height)
      )
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (ctx === null) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.72))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })

/** Read an image file into a composer attachment (full data + preview). */
export const readImageAttachment = async (
  file: File
): Promise<ComposerAttachment> => {
  const dataUrl = await readAsDataUrl(file)
  const thumbnail = await makeThumbnail(dataUrl)
  return {
    id: crypto.randomUUID(),
    name: file.name || "image",
    data: stripDataUrlPrefix(dataUrl),
    thumbnail,
  }
}

/** Strip the composer-only `id` before sending. */
export const toImagePayload = (a: ComposerAttachment): ChatImagePayload => ({
  name: a.name,
  data: a.data,
  thumbnail: a.thumbnail,
})
