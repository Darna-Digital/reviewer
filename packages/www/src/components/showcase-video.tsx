import { useEffect, useRef, useState } from "react";

/**
 * A short, silent screen recording. It plays on a loop while it's on screen
 * and pauses off screen or while `paused`, as in a hidden crossfade view.
 * Nothing downloads, not even the poster, until it's first unpaused and on
 * screen. With reduced motion it waits on its first frame with controls
 * instead. AV1 first, H.264 for Safari
 * before 17 and other browsers without AV1.
 */
export function ShowcaseVideo({
  label,
  name,
  paused = false,
}: {
  label: string;
  name: string;
  paused?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  // Set once the video is first shown; until then it has no poster or source.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (paused) {
      node.pause();
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return node.pause();
      setLoaded(true);
      if (reduced) setStill(true);
      // The sources render on this same commit, so wait a frame to play.
      else requestAnimationFrame(() => node.play().catch(() => setStill(true)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [paused]);

  return (
    <video
      aria-label={label}
      className="block h-auto w-full bg-neutral-900"
      controls={still}
      height={904}
      loop
      muted
      playsInline
      poster={loaded ? `/videos/${name}-poster.avif` : undefined}
      preload="none"
      ref={video}
      width={1600}
    >
      {loaded && (
        <>
          <source
            src={`/videos/${name}.av1.mp4`}
            type='video/mp4; codecs="av01.0.08M.08"'
          />
          <source src={`/videos/${name}.mp4`} type="video/mp4" />
        </>
      )}
    </video>
  );
}
