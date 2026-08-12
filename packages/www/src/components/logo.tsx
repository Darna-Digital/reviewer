export function Logo({ className }: { className?: string }) {
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet="/byconvo-logo-horizontal-white.svg"
      />
      <img
        alt=""
        className={className}
        height={315}
        src="/byconvo-logo-horizontal-black.svg"
        width={1278}
      />
    </picture>
  );
}
