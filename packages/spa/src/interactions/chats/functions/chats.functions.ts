import type {
  ChatsDependencies,
  ChatsFunctions,
} from "../interfaces/chats.interfaces"

export function createChatsFunctions(d: ChatsDependencies): ChatsFunctions {
  const send: ChatsFunctions["send"] = async (id, text, images = []) => {
    const prompt = text.trim()
    if (prompt.length === 0 && images.length === 0) return null
    return d.sideEffects.send(id, prompt, images)
  }

  const start = async (
    settings: Parameters<ChatsFunctions["start"]>[0],
    branch: string,
    text: string,
    images: Parameters<ChatsFunctions["start"]>[3] = [],
    title?: string
  ) => {
    const prompt = text.trim()
    if (prompt.length === 0 && images.length === 0) return null
    const trimmedTitle = title?.trim()
    // Create-on-first-message (t3code's draft promotion): assignment flows pass
    // a title, while regular chats let the server name the chat from the prompt.
    const created = await d.sideEffects.create({
      ...settings,
      branch,
      ...(trimmedTitle !== undefined && trimmedTitle.length > 0
        ? { title: trimmedTitle }
        : {}),
    })
    return d.sideEffects.send(created.id, prompt, images)
  }

  return {
    start: (settings, branch, text, images) =>
      start(settings, branch, text, images),
    startWithTitle: (settings, branch, title, text, images) =>
      start(settings, branch, text, images, title),
    send,
    updateSettings: (id, patch) => d.sideEffects.update(id, patch),
    rename: async (id, title) => {
      const trimmed = title.trim()
      return d.sideEffects.update(
        id,
        trimmed.length > 0 ? { title: trimmed } : {}
      )
    },
    stop: (id) => d.sideEffects.stop(id),
    remove: (id) => d.sideEffects.remove(id),
  }
}
