type IconProps = { className?: string };

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Icon({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...STROKE}
    >
      {children}
    </svg>
  );
}

export function ArrowRight({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </Icon>
  );
}

export function GitBranch({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="7" cy="6" r="2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="8" r="2" />
      <path d="M7 8v8M17 10c0 4-10 2-10 6" />
    </Icon>
  );
}

export function GitCommit({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M3 12h6M15 12h6" />
    </Icon>
  );
}

export function GitPullRequest({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="7" cy="6" r="2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M7 8v8M17 16V9a3 3 0 0 0-3-3h-2m0 0 2-2m-2 2 2 2" />
    </Icon>
  );
}

export function Folders({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M8 9a2 2 0 0 1 2-2h2l2 2h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z" />
      <path d="M17 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1" />
    </Icon>
  );
}

export function Terminal({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5 7l5 5-5 5M13 17h6" />
    </Icon>
  );
}

export function Play({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7 4v16l13-8z" />
    </Icon>
  );
}

export function Stop({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </Icon>
  );
}

export function Globe({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" />
    </Icon>
  );
}

export function Search({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </Icon>
  );
}

export function History({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" />
      <path d="M12 8v4l3 2" />
    </Icon>
  );
}

export function Message({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 15a2 2 0 0 1-2 2H9l-4 3V6a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z" />
    </Icon>
  );
}

export function Check({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Icon>
  );
}

export function Chevron({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M8 10l4 4 4-4" />
    </Icon>
  );
}

export function Cursor({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 4l12 7-5 1.5L10.5 18z" />
    </Icon>
  );
}

export function Sparkle({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 4l1.8 4.8L19 10.5l-5.2 1.7L12 17l-1.8-4.8L5 10.5l5.2-1.7z" />
    </Icon>
  );
}

export function Document({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M7 3h6l5 5v13H7z" />
      <path d="M13 3v5h5M10 13h6M10 17h4" />
    </Icon>
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
