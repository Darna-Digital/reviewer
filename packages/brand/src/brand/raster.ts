import { svgDataUrl } from "./svg";

// An <img> with no intrinsic size falls back to 300×150 and rasterises blurry
// when scaled up, so the exact pixel size is stamped on the root element.
function withPixelSize(svg: string, width: number, height: number) {
  return svg.replace(/<svg[^>]*>/, (tag) =>
    tag
      .replace(/\s(width|height)="[^"]*"/g, "")
      .replace("<svg", `<svg width="${width}" height="${height}"`)
  );
}

function loadImage(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not rasterise the SVG"));
    image.src = svgDataUrl(svg);
  });
}

export async function rasterize(
  svg: string,
  width: number,
  height: number
): Promise<Blob> {
  const pixelWidth = Math.max(1, Math.round(width));
  const pixelHeight = Math.max(1, Math.round(height));
  const image = await loadImage(withPixelSize(svg, pixelWidth, pixelHeight));
  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not rasterise the SVG");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the PNG")),
      "image/png"
    );
  });
}

export const ICO_SIZES = [16, 32, 48, 64, 128, 256] as const;

// A modern .ico is just a directory of PNGs, so the favicon can reuse the same
// rasteriser as every other export instead of hand-rolling a BMP encoder.
export async function encodeIco(
  pngs: Array<{ size: number; bytes: ArrayBuffer }>
) {
  const header = new DataView(new ArrayBuffer(6 + pngs.length * 16));
  header.setUint16(0, 0, true);
  header.setUint16(2, 1, true);
  header.setUint16(4, pngs.length, true);

  let offset = header.byteLength;
  pngs.forEach(({ size, bytes }, index) => {
    const entry = 6 + index * 16;
    header.setUint8(entry, size >= 256 ? 0 : size);
    header.setUint8(entry + 1, size >= 256 ? 0 : size);
    header.setUint8(entry + 2, 0);
    header.setUint8(entry + 3, 0);
    header.setUint16(entry + 4, 1, true);
    header.setUint16(entry + 6, 32, true);
    header.setUint32(entry + 8, bytes.byteLength, true);
    header.setUint32(entry + 12, offset, true);
    offset += bytes.byteLength;
  });

  return new Blob([header.buffer, ...pngs.map((png) => png.bytes)], {
    type: "image/x-icon",
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
