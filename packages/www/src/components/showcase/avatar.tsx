const TONES = [
  "bg-[#e8eef9] text-[#31518c]",
  "bg-[#fbeae4] text-[#9a4a25]",
  "bg-[#e6f2ea] text-[#2b6b45]",
  "bg-[#f0eaf9] text-[#5b3d8c]",
  "bg-[#fdf3dc] text-[#8a6516]",
];

export function Avatar({
  initials,
  className = "size-5 text-[9px]",
}: {
  initials: string;
  className?: string;
}) {
  const tone =
    TONES[
      [...initials].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        TONES.length
    ];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${tone} ${className}`}
    >
      {initials}
    </span>
  );
}
