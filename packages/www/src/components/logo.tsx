export function Logo({ className }: { className?: string }) {
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet="/reviewer-logo-horizontal-white.svg"
      />
      <img
        alt=""
        className={className}
        height={315}
        src="/reviewer-logo-horizontal-black.svg"
        width={1291}
      />
    </picture>
  );
}
