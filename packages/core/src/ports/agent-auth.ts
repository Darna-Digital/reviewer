/**
 * AgentAuth — signing in to an agent's vendor on this machine.
 *
 * The vendors' subscription logins are OAuth flows that redirect to a port on
 * localhost: `codex login` puts a server on 1455, opens a browser, and writes
 * what it gets back to `~/.codex/auth.json`. That only works somewhere the
 * browser and the listener are the same machine — which is here, and is not a
 * cloud sandbox.
 *
 * So this is the half reviewer can do that the cloud cannot: run the vendor's
 * own login, and hand back what it wrote so it can be carried to reviewer
 * cloud. The person clicks once and approves in their browser; no code is
 * typed anywhere.
 *
 * A port because none of that is core's business, and because a test wants to
 * say "the login worked and produced this" without a browser.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export class AgentAuthError extends Schema.TaggedError<AgentAuthError>()(
  "AgentAuthError",
  { reason: Schema.String },
  { httpApiStatus: 500 }
) {
  override get message(): string {
    return this.reason;
  }
}

/** The agents that can be signed in to on this machine. */
export const AGENT_AUTH_PROVIDERS = ["codex"] as const;
export type AgentAuthProvider = (typeof AGENT_AUTH_PROVIDERS)[number];

export interface AgentAuthShape {
  /**
   * What the vendor's CLI has already stored here, or null when nobody has
   * signed in. Checked first: someone who has run `codex login` before needs
   * no browser at all.
   */
  readonly existing: (
    provider: AgentAuthProvider
  ) => Effect.Effect<string | null, AgentAuthError>;
  /**
   * Run the vendor's own login and answer with what it wrote. Opens a browser
   * and does not return until the person has approved or it has given up.
   */
  readonly signIn: (
    provider: AgentAuthProvider
  ) => Effect.Effect<string, AgentAuthError>;
}

export class AgentAuth extends Context.Service<AgentAuth, AgentAuthShape>()(
  "AgentAuth"
) {}

// --- Memory ---------------------------------------------------------------

export interface MemoryAgentAuthScript {
  /** What is already on this machine. Null — nobody has signed in — by default. */
  readonly existing?: string | null;
  /** What a sign-in produces. */
  readonly signedIn?: string;
  readonly failure?: AgentAuthError;
}

export interface MemoryAgentAuth {
  readonly layer: Layer.Layer<AgentAuth>;
  readonly calls: {
    readonly existing: Array<AgentAuthProvider>;
    readonly signIn: Array<AgentAuthProvider>;
  };
}

export const MEMORY_CODEX_AUTH = '{"tokens":{"access_token":"memory"}}';

export const memoryAgentAuth = (
  script: MemoryAgentAuthScript = {}
): MemoryAgentAuth => {
  const calls: MemoryAgentAuth["calls"] = { existing: [], signIn: [] };
  const fail = <A>(): Effect.Effect<A, AgentAuthError> | null =>
    script.failure === undefined ? null : Effect.fail(script.failure);
  const layer = Layer.succeed(AgentAuth)(
    AgentAuth.of({
      existing: (provider) =>
        fail<string | null>() ??
        Effect.sync(() => {
          calls.existing.push(provider);
          return script.existing ?? null;
        }),
      signIn: (provider) =>
        fail<string>() ??
        Effect.sync(() => {
          calls.signIn.push(provider);
          return script.signedIn ?? MEMORY_CODEX_AUTH;
        }),
    })
  );
  return { layer, calls };
};

export const memoryLayer = (
  script: MemoryAgentAuthScript = {}
): Layer.Layer<AgentAuth> => memoryAgentAuth(script).layer;
