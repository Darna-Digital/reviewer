type IconProps = { className?: string };

/**
 * Drawn the way SF Symbols are: one monoline weight, round caps and joins,
 * generous corner radii, everything sitting in the same optical box so a row
 * of them reads as one set.
 */
const SYMBOL = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Symbol({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...SYMBOL}
    >
      {children}
    </svg>
  );
}

export function Bubble({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M20.5 11.4c0 3.9-3.8 7-8.5 7-.8 0-1.6-.1-2.3-.3l-4 1.9.9-3a6.5 6.5 0 0 1-3.1-5.6c0-3.9 3.8-7 8.5-7s8.5 3.1 8.5 7Z" />
    </Symbol>
  );
}

export function Bubbles({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M17.2 9.6c0 2.9-2.9 5.2-6.4 5.2-.6 0-1.2 0-1.7-.2L5.4 16l.7-2.3a4.9 4.9 0 0 1-2.3-4.1c0-2.9 2.9-5.2 6.4-5.2s7 2.3 7 5.2Z" />
      <path d="M17.1 19.2c.5 0 1-.1 1.4-.2l2.5 1-.5-1.6a3.4 3.4 0 0 0 1.1-2.4c0-1.6-1.3-2.9-3.1-3.3" />
    </Symbol>
  );
}

export function Sparkles({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M9.5 3.5 11 8l4.5 1.5L11 11l-1.5 4.5L8 11l-4.5-1.5L8 8l1.5-4.5Z" />
      <path d="M17.5 13.5 18.4 16l2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
    </Symbol>
  );
}

export function Play({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.3 9.3c0-.5.5-.8.9-.5l3.9 2.6c.4.3.4.9 0 1.1l-3.9 2.6c-.4.3-.9 0-.9-.5V9.3Z" />
    </Symbol>
  );
}

export function Terminal({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
      <path d="m7.8 10 2.2 2-2.2 2M12.8 15.2h3.6" />
    </Symbol>
  );
}

export function Branch({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <circle cx="7" cy="6" r="2.2" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="8.5" r="2.2" />
      <path d="M7 8.2v7.6M17 10.7c0 3.4-10 1.9-10 5.1" />
    </Symbol>
  );
}

export function PullRequest({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <circle cx="7" cy="6" r="2.2" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="18" r="2.2" />
      <path d="M7 8.2v7.6M17 15.8V10a3.5 3.5 0 0 0-3.5-3.5h-2.8" />
      <path d="m13 4.4-2.2 2.1L13 8.6" />
    </Symbol>
  );
}

export function History({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
      <path d="M3.4 3.9v3.3h3.3" />
      <path d="M12 7.8V12l2.9 1.8" />
    </Symbol>
  );
}

export function Folders({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M7.5 7.8V6.6c0-1 .8-1.9 1.9-1.9h2.3l1.6 1.8h4.3c1 0 1.9.8 1.9 1.9v.4" />
      <path d="M4.5 10.3c0-1 .8-1.9 1.9-1.9h2.9L11 10.2h4.6c1 0 1.9.8 1.9 1.9v5.4c0 1-.8 1.9-1.9 1.9H6.4c-1 0-1.9-.8-1.9-1.9v-7.2Z" />
    </Symbol>
  );
}

export function Command({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M9.5 9.5h5v5h-5v-5Zm0 0V7.3a2.3 2.3 0 1 0-2.3 2.2h2.3Zm5 0V7.3a2.3 2.3 0 1 1 2.3 2.2h-2.3Zm-5 5v2.2a2.3 2.3 0 1 1-2.3-2.2h2.3Zm5 0v2.2a2.3 2.3 0 1 0 2.3-2.2h-2.3Z" />
    </Symbol>
  );
}

export function Checkmark({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.2 12.2 2.6 2.6 5-5.6" />
    </Symbol>
  );
}

export function Laptop({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <rect x="4.5" y="5" width="15" height="10.5" rx="1.8" />
      <path d="M2.5 18.6h19" />
    </Symbol>
  );
}

export function Document({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M6 5.8c0-1 .8-1.9 1.9-1.9h5l5.1 5.1v9.2c0 1-.8 1.9-1.9 1.9H7.9c-1 0-1.9-.8-1.9-1.9V5.8Z" />
      <path d="M12.8 4v3.3c0 .9.7 1.6 1.6 1.6H18" />
    </Symbol>
  );
}

export function ChevronRight({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="m9.5 6 6 6-6 6" />
    </Symbol>
  );
}

export function GitHub({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2"
      />
    </svg>
  );
}
