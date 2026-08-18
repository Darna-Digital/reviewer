import { cn } from "#/lib/utils";

const TONES = [
  "bg-[#e8eef9] text-[#31518c] dark:bg-[#1c2a45] dark:text-[#a8c5f0]",
  "bg-[#fbeae4] text-[#9a4a25] dark:bg-[#43261a] dark:text-[#f0b088]",
  "bg-[#e6f2ea] text-[#2b6b45] dark:bg-[#1a3626] dark:text-[#8ed4a6]",
  "bg-[#f0eaf9] text-[#5b3d8c] dark:bg-[#2e2547] dark:text-[#c4b0ea]",
  "bg-[#fdf3dc] text-[#8a6516] dark:bg-[#42351a] dark:text-[#e6ca82]",
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
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        tone,
        className
      )}
    >
      {initials}
    </span>
  );
}
