import { useEffect, useRef } from "react";

/**
 * Reviewer Cloud has no screenshot yet, so its stage shows banks of cloud
 * drawn in diff marks: white on a baby-blue sky in light mode, on the noir
 * backdrop in dark mode. The denser the cloud, the heavier the mark. The layout comes from seeded noise, so it's the same on
 * every load, and it's drawn on a canvas at the screen's own resolution.
 */

/** From thin cloud to thick. */
const MARKS = [".", ":", "-", "=", "+"];

const CELL_WIDTH = 8;
const CELL_HEIGHT = 13;

function hash(x: number, y: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function noise(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smooth(x - x0);
  const sy = smooth(y - y0);
  const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const bottom =
    hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

/** Fractal noise, stretched sideways so the clouds lie in long banks. */
function cloud(u: number, v: number) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < 5; octave++) {
    value +=
      amplitude * noise(u * 2.6 * frequency + 11, v * 4.2 * frequency + 3);
    amplitude /= 2;
    frequency *= 2;
  }
  // Clouds gather towards the corners and leave the middle clear,
  const edge = Math.min(1, Math.abs(u - 0.5) * 1.3 + Math.abs(v - 0.5) * 1.1);
  // and a strip of clear sky along the top.
  const top = Math.max(0, 0.14 - v) * 3;
  return (value - 0.5) * 2 + edge * 0.55 - 0.42 - top;
}

const LIGHT = "(prefers-color-scheme: light)";

function draw(canvas: HTMLCanvasElement) {
  // White marks show less against a blue sky than a black one, so they're
  // drawn more opaque there.
  const light = window.matchMedia(LIGHT).matches;
  const [base, range] = light ? [0.25, 0.65] : [0.05, 0.36];
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(scale, scale);
  context.clearRect(0, 0, width, height);
  context.font = `${CELL_HEIGHT - 2}px ui-monospace, "SF Mono", Menlo, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  // The marks keep one size, so a wider stage draws the sky in more of them.
  const columns = Math.ceil(width / CELL_WIDTH);
  const rows = Math.ceil(height / CELL_HEIGHT);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // Scaled to the stage, so every width shows the same sky.
      const u = (column * CELL_WIDTH) / width;
      const v = (row * CELL_HEIGHT) / height;
      const x = column * CELL_WIDTH + CELL_WIDTH / 2;
      const y = row * CELL_HEIGHT + CELL_HEIGHT / 2;
      const density = cloud(u, v);
      if (density > 0) {
        // A cloud's edge frays into scattered marks; its core is solid and
        // heavier.
        const fill = Math.min(1, density * 3.2);
        if (hash(column, row + 999) > 0.3 + fill * 0.7) continue;
        const jitter = (hash(column + 3, row + 5) - 0.5) * 0.8;
        const level = Math.max(
          0,
          Math.min(MARKS.length - 1, Math.floor((fill + jitter) * MARKS.length))
        );
        context.fillStyle = `rgba(255,255,255,${base + fill ** 1.5 * range})`;
        context.fillText(MARKS[level], x, y);
      } else if (hash(column + 7, row + 13) < 0.006) {
        // Specks in the clear sky, the odd one bright.
        const bright = hash(column, row) < 0.12;
        context.fillStyle = `rgba(255,255,255,${bright ? 0.9 : 0.12 + hash(row, column) * 0.3})`;
        context.fillText(bright ? "+" : "·", x, y);
      }
    }
  }
}

export function CloudIllustration() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const redraw = () => draw(node);
    redraw();
    const observer = new ResizeObserver(redraw);
    observer.observe(node);
    const scheme = window.matchMedia(LIGHT);
    scheme.addEventListener("change", redraw);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", redraw);
    };
  }, []);

  return (
    <div className="sky aspect-[2560/1358]">
      <canvas
        aria-label="Banks of cloud drawn in diff marks across the sky"
        className="block size-full"
        ref={canvas}
        role="img"
      />
    </div>
  );
}
