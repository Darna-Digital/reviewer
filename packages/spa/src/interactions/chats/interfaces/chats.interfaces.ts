/**
 * `chats` feature — agent conversations (distinct from terminal threads).
 * The orchestration that deserves tests lives here behind injected API side
 * effects: trimming prompts, skipping blank sends, the create-on-first-message
 * flow, and the pure reducer that applies streamed turn events to a chat.
 */
import type {
  Chat,
  ChatAccess,
  ChatEffort,
  ChatImageUpload,
  ChatProviderKind,
} from "@byconvo/core/chats";

export type { ChatWireEvent } from "@byconvo/core/chats";

/** Images sent with a prompt (server type ChatImageUpload). */
export type ChatImage = ChatImageUpload;

/**
 * Where a session runs: the branch it is on, and the checkout its agent's
 * process is started in. The checkout is only ever named when it is not the one
 * the app has selected — a task cut into a worktree of its own — which is what
 * lets a task start without the app going there.
 */
export interface ChatPlace {
  readonly branch: string;
  readonly repoPath?: string;
}

/** The composer's settings for a chat (what the picker/menus edit). */
export interface ChatSettings {
  readonly provider: ChatProviderKind;
  readonly model: string;
  readonly effort: ChatEffort;
  readonly access: ChatAccess;
}

export interface ChatsDependencies {
  data: Record<string, never>;
  sideEffects: {
    readonly create: (input: {
      title?: string;
      provider: ChatProviderKind;
      model: string;
      effort: ChatEffort;
      access: ChatAccess;
      branch?: string;
      repoPath?: string;
    }) => Promise<Chat>;
    readonly send: (
      id: string,
      text: string,
      images: ReadonlyArray<ChatImage>
    ) => Promise<Chat>;
    readonly update: (
      id: string,
      input: Partial<ChatSettings> & { title?: string }
    ) => Promise<Chat>;
    readonly stop: (id: string) => Promise<void>;
    readonly remove: (id: string) => Promise<void>;
  };
}

export interface ChatsFunctions {
  /** The new-thread flow: create a chat with `settings` and immediately send
   * the first prompt (and any images). Returns null (no-op) when the prompt is
   * blank and no images are attached. */
  readonly start: (
    settings: ChatSettings,
    place: ChatPlace,
    text: string,
    images?: ReadonlyArray<ChatImage>
  ) => Promise<Chat | null>;
  /** Create a titled chat, then immediately send the first prompt. */
  readonly startWithTitle: (
    settings: ChatSettings,
    place: ChatPlace,
    title: string,
    text: string,
    images?: ReadonlyArray<ChatImage>
  ) => Promise<Chat | null>;
  /** Send a prompt (and any images); returns null (no-op) when both are empty. */
  readonly send: (
    id: string,
    text: string,
    images?: ReadonlyArray<ChatImage>
  ) => Promise<Chat | null>;
  /** Patch composer settings on an existing chat. */
  readonly updateSettings: (
    id: string,
    patch: Partial<ChatSettings>
  ) => Promise<Chat>;
  readonly rename: (id: string, title: string) => Promise<Chat>;
  readonly stop: (id: string) => Promise<void>;
  readonly remove: (id: string) => Promise<void>;
}
