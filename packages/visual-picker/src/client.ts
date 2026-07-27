import type { NewVisualComment, VisualComment } from "./types.ts"

const DEFAULT_ORIGIN = "http://localhost:41811"

const originFromScriptTag = () => {
  const current = document.currentScript as HTMLScriptElement | null
  if (current !== null && current.src.length > 0) {
    try {
      return new URL(current.src).origin
    } catch {
      /* fall through to the default */
    }
  }
  return DEFAULT_ORIGIN
}

const base = `${originFromScriptTag()}/api/visual-comments`

const json = async (response: Response) => {
  if (!response.ok) {
    throw new Error(`byconvo responded ${response.status}`)
  }
  return response.json()
}

export const listComments = (): Promise<Array<VisualComment>> =>
  fetch(base).then(json)

export const createComment = (
  input: NewVisualComment
): Promise<VisualComment> =>
  fetch(base, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }).then(json)

export const deleteComment = async (id: string): Promise<void> => {
  await fetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }).then(
    json
  )
}
