import type { BrandConfig } from "./config";
import { MARK_CELLS, MARK_COLUMNS, MARK_ROWS } from "./mark";
import type { OutlinedText } from "./font";

/** Every measurement below is in design units, one grid cell being 100. */
export const CELL = 100;
export const MARK_WIDTH = MARK_COLUMNS * CELL;
export const MARK_HEIGHT = MARK_ROWS * CELL;

export type Box = { x: number; y: number; width: number; height: number };
export type RoundedBox = Box & { radius: number };

export type Scene = {
  width: number;
  height: number;
  plate: RoundedBox | null;
  tile: RoundedBox | null;
  blocks: Array<RoundedBox>;
  text: { d: string; x: number; baseline: number } | null;
};

/** Side of the square tile that leaves `markPadding` around the mark. */
export function tileSide(markPadding: number) {
  return MARK_HEIGHT / Math.max(1 - 2 * markPadding, 0.05);
}

function markBlocks(config: BrandConfig, originX: number, originY: number) {
  const inset = (config.blockGap * CELL) / 2;
  const size = CELL - 2 * inset;
  return MARK_CELLS.map(({ column, row }) => ({
    x: originX + column * CELL + inset,
    y: originY + row * CELL + inset,
    width: size,
    height: size,
    radius: config.blockRadius * size,
  }));
}

export function buildScene(
  config: BrandConfig,
  text: OutlinedText | null
): Scene {
  const side = tileSide(config.markPadding);
  const showsMark = config.layout !== "wordmark";
  const showsText = config.layout !== "mark" && text !== null && text.width > 0;
  // The square `mark` layout is nothing but the tile, so it always draws one;
  // the lockups only get a tile when you ask for one behind the mark.
  const standalone = config.layout === "mark";
  const tiled = standalone || config.markTile;

  const markBox: Box = tiled
    ? { x: 0, y: 0, width: side, height: side }
    : { x: 0, y: 0, width: MARK_WIDTH, height: MARK_HEIGHT };

  const gap = showsMark && showsText ? config.lockupGap * MARK_HEIGHT : 0;
  const textBox: Box = showsText
    ? { x: 0, y: 0, width: text.width, height: text.capHeight }
    : { x: 0, y: 0, width: 0, height: 0 };

  let contentWidth: number;
  let contentHeight: number;
  if (!showsText) {
    contentWidth = markBox.width;
    contentHeight = markBox.height;
  } else if (!showsMark) {
    contentWidth = textBox.width;
    contentHeight = textBox.height;
  } else if (config.layout === "stacked") {
    contentWidth = Math.max(markBox.width, textBox.width);
    contentHeight = markBox.height + gap + textBox.height;
  } else {
    contentWidth = markBox.width + gap + textBox.width;
    contentHeight = Math.max(markBox.height, textBox.height);
  }

  // A lockup gets the same breathing room around its plate that the icon tile
  // gives the mark, so the two read as one family; canvas padding is on top.
  const pad =
    (standalone ? 0 : config.markPadding * side) +
    config.canvasPadding * MARK_HEIGHT;
  const width = contentWidth + 2 * pad;
  const height = contentHeight + 2 * pad;

  if (config.layout === "stacked") {
    markBox.x = pad + (contentWidth - markBox.width) / 2;
    markBox.y = pad;
    textBox.x = pad + (contentWidth - textBox.width) / 2;
    textBox.y = pad + markBox.height + gap;
  } else {
    markBox.x = pad;
    markBox.y = pad + (contentHeight - markBox.height) / 2;
    textBox.x = pad + (showsMark ? markBox.width + gap : 0);
    textBox.y = pad + (contentHeight - textBox.height) / 2;
  }

  const markOriginX = tiled ? markBox.x + (side - MARK_WIDTH) / 2 : markBox.x;
  const markOriginY = tiled ? markBox.y + (side - MARK_HEIGHT) / 2 : markBox.y;

  const plate: RoundedBox | null =
    standalone || config.plate.kind === "transparent"
      ? null
      : {
          x: 0,
          y: 0,
          width,
          height,
          radius: config.plateRadius * Math.min(width, height),
        };

  return {
    width,
    height,
    plate,
    tile:
      tiled && config.tile.kind !== "transparent"
        ? { ...markBox, radius: config.tileRadius * side }
        : null,
    blocks: showsMark ? markBlocks(config, markOriginX, markOriginY) : [],
    text: showsText
      ? { d: text.d, x: textBox.x, baseline: textBox.y + textBox.height }
      : null,
  };
}
