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

export function SplitDiff({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.2" />
      <path d="M12 4.5v15" />
      <path d="M6.3 9h3M6.3 12.5h2.2M14.7 9h3M14.7 12.5h3M14.7 16h2" />
    </Symbol>
  );
}

export function Braces({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M8.5 4.5c-1.7 0-2.5.8-2.5 2.4v2.4c0 1.3-.7 2.2-2 2.7 1.3.5 2 1.4 2 2.7v2.4c0 1.6.8 2.4 2.5 2.4" />
      <path d="M15.5 4.5c1.7 0 2.5.8 2.5 2.4v2.4c0 1.3.7 2.2 2 2.7-1.3.5-2 1.4-2 2.7v2.4c0 1.6-.8 2.4-2.5 2.4" />
    </Symbol>
  );
}

export function Contrast({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" />
    </Symbol>
  );
}

export function Palette({ className }: IconProps) {
  return (
    <Symbol className={className}>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2c2.2 0 4-1.8 4-4 0-4-3.8-7.2-8.5-7.2Z" />
      <circle cx="7.6" cy="11.5" r="1" fill="currentColor" />
      <circle cx="10.2" cy="7.6" r="1" fill="currentColor" />
      <circle cx="14.6" cy="7.9" r="1" fill="currentColor" />
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

export function Apple({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.37 12.62c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.96-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66ZM14.1 5.87c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.09 1.76-.96 2.79 1.02.08 2.05-.51 2.68-1.27Z"
      />
    </svg>
  );
}
