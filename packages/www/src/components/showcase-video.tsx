import { useEffect, useRef, useState } from "react";

/**
 * A short, silent screen recording in a showcase card. It plays on a loop
 * while it's on screen and pauses off screen. With reduced motion it waits
 * on its first frame with controls instead. AV1 first, H.264 for Safari
 * before 17 and other browsers without AV1.
 */
export function ShowcaseVideo({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void node.play().catch(() => setStill(true));
      else node.pause();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      aria-label={label}
      className="block h-auto w-full"
      controls={still}
      height={904}
      loop
      muted
      playsInline
      poster={`/videos/${name}-poster.avif`}
      preload="none"
      ref={video}
      width={1600}
    >
      <source
        src={`/videos/${name}.av1.mp4`}
        type='video/mp4; codecs="av01.0.08M.08"'
      />
      <source src={`/videos/${name}.mp4`} type="video/mp4" />
    </video>
  );
}
