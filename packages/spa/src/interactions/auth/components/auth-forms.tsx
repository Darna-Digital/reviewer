/**
 * Sign in, sign up, and asking for a password reset — one card with three
 * states rather than three routes, because they are the same six inputs and
 * switching between them should not cost a navigation.
 *
 * Validation runs on submit and then live, so the first attempt is not
 * pre-emptively red but a correction is acknowledged as it is typed.
 */
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { requestPasswordReset, signIn, signUp } from "@/lib/central/auth-client"
import {
  hasErrors,
  passwordStrength,
  validateSignIn,
  validateSignUp,
  type FieldErrors,
  type PasswordStrength,
} from "../functions/auth.functions"

type Mode = "sign-in" | "sign-up" | "reset"

const STRENGTH_COPY: Record<PasswordStrength, string> = {
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
}

const STRENGTH_BAR: Record<PasswordStrength, string> = {
  weak: "w-1/3 bg-destructive",
  fair: "w-2/3 bg-amber-500",
  strong: "w-full bg-emerald-500",
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error !== undefined && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </label>
  )
}

export function AuthForms() {
  const [mode, setMode] = useState<Mode>("sign-in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  const revalidate = (next: Partial<Record<string, string>> = {}) => {
    if (!touched) return
    const values = {
      name,
      email,
      password,
      confirm,
      ...next,
    }
    setErrors(
      mode === "sign-up" ? validateSignUp(values) : validateSignIn(values)
    )
  }

  const submit = async () => {
    setTouched(true)
    const found =
      mode === "sign-up"
        ? validateSignUp({ name, email, password, confirm })
        : mode === "sign-in"
          ? validateSignIn({ email, password })
          : validateSignIn({ email, password: "placeholder" })
    setErrors(found)
    if (hasErrors(found)) return

    setBusy(true)
    try {
      if (mode === "reset") {
        const { error } = await requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error != null) throw new Error(error.message)
        setSent(`If ${email} has an account, a reset link is on its way.`)
        return
      }

      if (mode === "sign-up") {
        const { error } = await signUp.email({ name, email, password })
        if (error != null) throw new Error(error.message)
        setSent(
          `Check ${email} for a confirmation link — you can sign in once the address is confirmed.`
        )
        return
      }

      const { error } = await signIn.email({ email, password })
      if (error != null) throw new Error(error.message)
      // The session hook picks the new session up; the gate swaps itself out.
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "something went wrong"
      )
    } finally {
      setBusy(false)
    }
  }

  if (sent !== null) {
    return (
      <div className="w-full max-w-sm rounded-xl border bg-surface-2 p-6 text-center shadow-surface-2">
        <h1 className="text-base font-medium">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">{sent}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            setSent(null)
            setMode("sign-in")
          }}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  const strength = passwordStrength(password)

  return (
    <div className="w-full max-w-sm rounded-xl border bg-surface-2 p-6 shadow-surface-2">
      <h1 className="text-base font-medium">
        {mode === "sign-in" && "Sign in to your workspace"}
        {mode === "sign-up" && "Create your workspace"}
        {mode === "reset" && "Reset your password"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "sign-in" &&
          "Projects, issues and docs, shared with your team."}
        {mode === "sign-up" &&
          "You'll get a workspace of your own to start in."}
        {mode === "reset" && "We'll email you a link to choose a new one."}
      </p>

      <form
        className="mt-5 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {mode === "sign-up" && (
          <Field label="Name" error={errors.name}>
            <Input
              value={name}
              autoComplete="name"
              onChange={(event) => {
                setName(event.target.value)
                revalidate({ name: event.target.value })
              }}
            />
          </Field>
        )}

        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            value={email}
            autoComplete="email"
            autoFocus
            onChange={(event) => {
              setEmail(event.target.value)
              revalidate({ email: event.target.value })
            }}
          />
        </Field>

        {mode !== "reset" && (
          <Field label="Password" error={errors.password}>
            <Input
              type="password"
              value={password}
              autoComplete={
                mode === "sign-up" ? "new-password" : "current-password"
              }
              onChange={(event) => {
                setPassword(event.target.value)
                revalidate({ password: event.target.value })
              }}
            />
            {mode === "sign-up" && password.length > 0 && (
              <span className="mt-1 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-elevate-strong">
                  <span
                    className={cn(
                      "block h-full rounded-full transition-all duration-200",
                      STRENGTH_BAR[strength]
                    )}
                  />
                </span>
                <span className="w-10 text-right text-[11px] text-muted-foreground">
                  {STRENGTH_COPY[strength]}
                </span>
              </span>
            )}
          </Field>
        )}

        {mode === "sign-up" && (
          <Field label="Confirm password" error={errors.confirm}>
            <Input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(event) => {
                setConfirm(event.target.value)
                revalidate({ confirm: event.target.value })
              }}
            />
          </Field>
        )}

        <Button type="submit" disabled={busy} className="mt-1">
          {busy
            ? "Working…"
            : mode === "sign-in"
              ? "Sign in"
              : mode === "sign-up"
                ? "Create account"
                : "Send reset link"}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-xs">
        {mode === "sign-in" ? (
          <>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setMode("reset")}
            >
              Forgot your password?
            </button>
            <button
              type="button"
              className="text-link hover:underline"
              onClick={() => {
                setMode("sign-up")
                setErrors({})
                setTouched(false)
              }}
            >
              Create an account
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-link hover:underline"
            onClick={() => {
              setMode("sign-in")
              setErrors({})
              setTouched(false)
            }}
          >
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
