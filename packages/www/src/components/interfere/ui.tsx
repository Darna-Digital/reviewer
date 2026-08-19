import type { ReactNode } from "react";

import { cn } from "#/lib/utils";

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1248px] px-6", className)}>
      {children}
    </div>
  );
}

export function HairlineDivider({ className = "" }: { className?: string }) {
  return (
    <Container className={className}>
      <div className="h-px w-full bg-black/8" role="separator" />
    </Container>
  );
}

const BUTTON_SIZES = {
  md: "h-8 px-3 text-sm",
  xl: "h-11 px-5 text-[15px]",
} as const;

const BUTTON_VARIANTS = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-900/90",
  secondary:
    "bg-white text-neutral-900 shadow-sm ring-1 ring-black/10 ring-inset hover:bg-neutral-50",
  transparent: "text-neutral-600 hover:bg-black/5 hover:text-neutral-900",
} as const;

export function Button({
  href,
  variant = "secondary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors select-none",
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className
      )}
      href={href}
    >
      {children}
    </a>
  );
}

export function MonoLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-xs leading-none tracking-wide text-neutral-500 uppercase select-none",
        className
      )}
    >
      {children}
    </span>
  );
}

export function InitialsAvatar({
  initials,
  className = "size-5 text-[8px]",
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-neutral-200 font-medium text-neutral-600 ring-1 ring-black/8",
        className
      )}
    >
      {initials}
    </span>
  );
}

type GlyphProps = { className?: string };

function Glyph({ className, children }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

export function InboxGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M4 13h4l2 3h4l2-3h4" />
      <path d="M6 5h12l2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z" />
    </Glyph>
  );
}

export function WarningGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4M12 17.2v.2" />
    </Glyph>
  );
}

export function PulseGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M3 12h4l3-7 4 14 3-7h4" />
    </Glyph>
  );
}

export function ShieldGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z" />
    </Glyph>
  );
}

export function StarsGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
    </Glyph>
  );
}

export function ChevronRightGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M9 6l6 6-6 6" />
    </Glyph>
  );
}

export function ArrowUpRightGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M7 17 17 7M9 7h8v8" />
    </Glyph>
  );
}

export function CheckGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M5 12.5 10 17.5 19 7" />
    </Glyph>
  );
}

export function FileGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
    </Glyph>
  );
}

export function UserGlyph({ className }: GlyphProps) {
  return (
    <Glyph className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </Glyph>
  );
}

export function InterfereLogo({ className = "h-4" }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <svg
        aria-hidden="true"
        className="h-full w-auto"
        fill="currentColor"
        viewBox="0 0 18 18"
      >
        <rect height="4" width="4" x="0" y="7" />
        <rect height="4" width="4" x="7" y="0" />
        <rect height="4" width="4" x="7" y="14" />
        <rect height="4" width="4" x="14" y="7" />
        <rect height="2" width="2" x="4.5" y="4.5" />
        <rect height="2" width="2" x="11.5" y="4.5" />
        <rect height="2" width="2" x="4.5" y="11.5" />
        <rect height="2" width="2" x="11.5" y="11.5" />
      </svg>
      <span className="font-mono text-sm font-semibold tracking-[0.18em] text-current uppercase">
        Interfere
      </span>
    </span>
  );
}
