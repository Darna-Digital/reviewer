import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <h2 className="mb-3 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-white/70">{label}</span>
        {value !== undefined ? (
          <span className="font-mono text-[11px] text-muted tabular-nums">
            {value}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  onReset?: () => void;
}) {
  return (
    <Field
      label={label}
      value={
        <button
          type="button"
          onClick={onReset}
          disabled={!onReset}
          title={onReset ? "Reset to default" : undefined}
          className="cursor-pointer tabular-nums transition-colors not-disabled:hover:text-white disabled:cursor-default"
        >
          {format ? format(value) : value}
        </button>
      }
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; title?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-raised p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 cursor-pointer rounded-md px-2 py-1.5 text-xs whitespace-nowrap transition-colors",
            option.value === value
              ? "bg-white text-ink"
              : "text-white/60 hover:bg-white/5 hover:text-white"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
    >
      <span className="text-xs text-white/70">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-white" : "bg-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full transition-all",
            checked ? "left-4.5 bg-ink" : "left-0.5 bg-white/50"
          )}
        />
      </span>
    </button>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/70">{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="w-20 rounded-md border border-line bg-raised px-2 py-1 font-mono text-[11px] uppercase outline-none focus:border-white/40"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        className="w-full rounded-lg border border-line bg-raised px-2.5 py-1.5 text-sm outline-none focus:border-white/40"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "cursor-pointer rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-40",
        variant === "primary"
          ? "bg-white text-ink not-disabled:hover:bg-white/85"
          : "border border-line bg-raised text-white not-disabled:hover:border-white/30 not-disabled:hover:bg-white/5",
        className
      )}
    >
      {children}
    </button>
  );
}
