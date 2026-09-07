export function Logo({ className }: { className?: string }) {
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet="/reviewer-logo-mark-white.svg"
      />
      <img
        alt=""
        className={className}
        height={315}
        src="/reviewer-logo-mark-black.svg"
        width={315}
      />
    </picture>
  );
}
