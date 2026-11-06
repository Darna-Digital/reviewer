import { useEffect, useRef, useState, type FormEvent } from "react";

import { cn } from "#/lib/cn";
import { getTurnstileSiteKey, joinWaitlist } from "#/lib/waitlist";

let turnstileScript: Promise<void> | undefined;

/** Loads Turnstile's script once per page, the first time a form needs it. */
function loadTurnstile() {
  turnstileScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile didn't load."));
    document.head.append(script);
  });
  return turnstileScript;
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "joined"; email: string }
  | { kind: "failed"; message: string };

/** An email field and a button that put the address on the cloud waitlist. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Turnstile's spam check. It starts when someone first focuses or points at
  // the form, runs invisibly, and only shows a checkbox when it needs one.
  const widget = useRef<HTMLDivElement>(null);
  const check = useRef<{
    started?: boolean;
    id?: string;
    token?: string;
    waiting: Array<(token: string) => void>;
  }>({ waiting: [] });

  const settle = (token: string) => {
    check.current.token = token || undefined;
    for (const resolve of check.current.waiting.splice(0)) resolve(token);
  };

  const startCheck = () => {
    if (check.current.started) return;
    check.current.started = true;
    Promise.all([getTurnstileSiteKey(), loadTurnstile()])
      .then(([sitekey]) => {
        if (!sitekey || !widget.current || !window.turnstile) {
          settle("");
          return;
        }
        check.current.id = window.turnstile.render(widget.current, {
          sitekey,
          appearance: "interaction-only",
          action: "waitlist",
          callback: settle,
          "error-callback": () => settle(""),
          "expired-callback": () => {
            check.current.token = undefined;
          },
        });
      })
      .catch(() => settle(""));
  };

  useEffect(
    () => () => {
      if (check.current.id) window.turnstile?.remove(check.current.id);
    },
    []
  );

  /** The current token, waiting for Turnstile if it hasn't finished. */
  const getToken = () => {
    startCheck();
    const { token } = check.current;
    if (token) return Promise.resolve(token);
    return new Promise<string>((resolve) =>
      check.current.waiting.push(resolve)
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: "sending" });
    try {
      const token = await getToken();
      await joinWaitlist({ data: { email, token } });
      setStatus({ kind: "joined", email: email.trim() });
    } catch (error) {
      // A token works once, so a failed attempt needs a fresh one.
      check.current.token = undefined;
      if (check.current.id) window.turnstile?.reset(check.current.id);
      setStatus({
        kind: "failed",
        message:
          error instanceof Error && error.message
            ? error.message
            : "That didn't go through. Try again in a minute.",
      });
    }
  };

  if (status.kind === "joined") {
    return (
      <p
        className="rounded-[20px] bg-black/[0.035] px-5 py-4 text-[15px] leading-relaxed text-pretty ring-1 ring-black/[0.06] ring-inset dark:bg-white/[0.04] dark:ring-white/[0.08]"
        role="status"
      >
        You're on the list. We'll email{" "}
        <span className="font-semibold">{status.email}</span> when Reviewer
        Cloud opens.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      noValidate
      onFocus={startCheck}
      onPointerEnter={startCheck}
      onSubmit={submit}
    >
      <div className="flex items-center gap-2 rounded-full bg-black/[0.035] p-1.5 ring-1 ring-black/10 ring-inset focus-within:ring-black/30 dark:bg-white/[0.04] dark:ring-white/15 dark:focus-within:ring-white/35">
        <label className="sr-only" htmlFor="waitlist-email">
          Email address
        </label>
        <input
          aria-describedby="waitlist-hint"
          aria-invalid={status.kind === "failed"}
          autoComplete="email"
          className="h-10 min-w-0 flex-1 bg-transparent pl-3.5 text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          id="waitlist-email"
          inputMode="email"
          onChange={(event) => {
            setEmail(event.target.value);
            if (status.kind === "failed") setStatus({ kind: "idle" });
          }}
          placeholder="Email address"
          type="email"
          value={email}
        />
        <button
          className="h-10 shrink-0 rounded-full bg-neutral-900 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          disabled={status.kind === "sending"}
          type="submit"
        >
          {status.kind === "sending" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      <div className="empty:hidden" ref={widget} />
      <p
        className={cn(
          "pl-5 text-sm",
          status.kind === "failed"
            ? "text-red-600 dark:text-red-400"
            : "text-neutral-500"
        )}
        id="waitlist-hint"
      >
        {status.kind === "failed"
          ? status.message
          : "We'll email you when it opens."}
      </p>
    </form>
  );
}
