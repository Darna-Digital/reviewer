import type { BrandConfig, Fill } from "./config";
import type { RoundedBox, Scene } from "./geometry";

const round = (value: number) => Number(value.toFixed(3));

/** CSS-style angle: 0° points up, 90° points right. */
function gradientVector(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  return {
    x1: round(0.5 - dx),
    y1: round(0.5 - dy),
    x2: round(0.5 + dx),
    y2: round(0.5 + dy),
  };
}

function rect(box: RoundedBox, fill: string) {
  const radius = box.radius > 0 ? ` rx="${round(box.radius)}"` : "";
  return `<rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}"${radius} fill="${fill}"/>`;
}

function roundedRectPath(box: RoundedBox) {
  const x = round(box.x);
  const y = round(box.y);
  const right = round(box.x + box.width);
  const bottom = round(box.y + box.height);
  const r = round(Math.min(box.radius, box.width / 2, box.height / 2));
  if (r <= 0) return `M${x} ${y}H${right}V${bottom}H${x}Z`;

  const arc = `A${r} ${r} 0 0 1 `;
  return (
    `M${round(box.x + r)} ${y}H${round(box.x + box.width - r)}${arc}${right} ${round(box.y + r)}` +
    `V${round(box.y + box.height - r)}${arc}${round(box.x + box.width - r)} ${bottom}` +
    `H${round(box.x + r)}${arc}${x} ${round(box.y + box.height - r)}` +
    `V${round(box.y + r)}${arc}${round(box.x + r)} ${y}Z`
  );
}

export type RenderOptions = { title?: string };

export function renderSvg(
  scene: Scene,
  config: BrandConfig,
  options: RenderOptions = {}
): string {
  const defs: Array<string> = [];
  const paint = (fill: Fill, id: string) => {
    if (fill.kind !== "gradient") return fill.color;
    const { x1, y1, x2, y2 } = gradientVector(fill.angle);
    defs.push(
      `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
        `<stop offset="0" stop-color="${fill.color}"/>` +
        `<stop offset="1" stop-color="${fill.colorTo}"/>` +
        `</linearGradient>`
    );
    return `url(#${id})`;
  };

  const body: Array<string> = [];
  if (scene.plate) body.push(rect(scene.plate, paint(config.plate, "plate")));
  if (scene.tile) body.push(rect(scene.tile, paint(config.tile, "tile")));

  // One path, not one rect per cell: separate shapes that share an edge each
  // antialias against the background, which leaves a hairline seam running
  // through the mark. Filling them as a single path rasterises the union.
  if (scene.blocks.length && config.blocks.kind !== "transparent") {
    const d = scene.blocks.map(roundedRectPath).join("");
    body.push(`<path d="${d}" fill="${paint(config.blocks, "blocks")}"/>`);
  }

  if (scene.text) {
    const fill = config.linkWordmarkColor ? config.blocks : config.wordmarkFill;
    if (fill.kind !== "transparent") {
      body.push(
        `<g transform="translate(${round(scene.text.x)} ${round(scene.text.baseline)})">` +
          `<path d="${scene.text.d}" fill="${paint(fill, "wordmark")}"/></g>`
      );
    }
  }

  const title = options.title ? `<title>${options.title}</title>` : "";
  const defsBlock = defs.length ? `<defs>${defs.join("")}</defs>` : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(scene.width)} ${round(scene.height)}" fill="none">` +
    `${title}${defsBlock}${body.join("")}</svg>`
  );
}

export function formatSvg(svg: string) {
  return svg
    .replace(/></g, ">\n<")
    .replace(/\n<(rect|path|stop|title|g|\/)/g, "\n  <$1")
    .replace(/\n {2}<\/svg>/, "\n</svg>");
}

export const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
