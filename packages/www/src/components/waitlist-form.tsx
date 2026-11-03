import { useState, type FormEvent } from "react";

import { cn } from "#/lib/cn";
import { joinWaitlist } from "#/lib/waitlist";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "joined"; email: string }
  | { kind: "failed"; message: string };

/** An email field and a button that put the address on the cloud waitlist. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: "sending" });
    try {
      await joinWaitlist({ data: { email } });
      setStatus({ kind: "joined", email: email.trim() });
    } catch (error) {
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
    <form className="flex flex-col gap-2" noValidate onSubmit={submit}>
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
          : "We'll email you once, when it opens."}
      </p>
    </form>
  );
}
