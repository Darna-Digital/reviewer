/**
 * `cloud` feature — byconvo's connection to byconvo cloud, and the runs it
 * hands over. The orchestration worth testing lives behind injected side
 * effects: the device flow's polling (when to ask again, when to stop),
 * and turning the composer's local settings into a cloud run.
 */
import type {
  CloudConnection,
  CloudRepo,
  CloudRunSnapshot,
  CloudRunSummary,
  NewCloudRun,
} from "@byconvo/core/cloud";
import type { ChatSettings } from "@/interactions/chats/interfaces/chats.interfaces";

/** Where a cloud run works: the linked repository, and the branch to start from. */
export interface CloudRunPlace {
  readonly repo: CloudRepo;
  /** The branch the run starts from; null leaves it to the repository's default. */
  readonly baseBranch: string | null;
}

export interface CloudDependencies {
  data: Record<string, never>;
  sideEffects: {
    readonly connect: (serverUrl: string) => Promise<CloudConnection>;
    readonly poll: () => Promise<CloudConnection>;
    readonly disconnect: () => Promise<CloudConnection>;
    readonly createRun: (input: NewCloudRun) => Promise<CloudRunSnapshot>;
    readonly send: (id: string, prompt: string) => Promise<CloudRunSnapshot>;
    readonly cancel: (id: string) => Promise<CloudRunSnapshot>;
    /** Wait — injectable so the tests never sleep. */
    readonly delay: (ms: number) => Promise<void>;
    readonly now: () => number;
  };
}

/** How the device flow ended. */
export type CloudApproval =
  | { readonly kind: "connected"; readonly connection: CloudConnection }
  | { readonly kind: "expired" }
  | { readonly kind: "denied" }
  | { readonly kind: "cancelled" };

export interface CloudFunctions {
  /** Start the device flow; the result carries the code to show. */
  readonly connect: (serverUrl: string) => Promise<CloudConnection>;
  /**
   * Poll until the person approves, the code lapses, or `signal` aborts.
   * Paced by the interval the cloud asked for, and slowed when it says so.
   */
  readonly awaitApproval: (
    pending: CloudConnection,
    signal?: AbortSignal
  ) => Promise<CloudApproval>;
  readonly disconnect: () => Promise<CloudConnection>;
  /** Hand a prompt to the cloud; null (no-op) when the prompt is blank. */
  readonly startCloudRun: (
    settings: ChatSettings,
    place: CloudRunPlace,
    text: string
  ) => Promise<CloudRunSnapshot | null>;
  readonly send: (id: string, text: string) => Promise<CloudRunSnapshot | null>;
  readonly cancel: (id: string) => Promise<CloudRunSnapshot>;
}

export type { CloudConnection, CloudRepo, CloudRunSnapshot, CloudRunSummary };
