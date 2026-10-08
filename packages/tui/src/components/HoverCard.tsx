import * as React from 'react';
import type { HoverCard as Card } from '../app/useSymbols';
import { highlightSnippet } from '../diff/highlight';
import type { LineTokens } from '../diff/highlight';
import { mix } from '../render/palette';
import type { Palette } from '../render/palette';
import type { Seg } from '../render/styled';
import { wrapProse } from '../text/measure';
import { useAppContext } from './AppContext';
import { Line } from './Line';

const MAX_WIDTH = 80;
const MAX_LINES = 14;

/**
 * The language server's hover for the symbol under the pointer: its
 * signature in code colours, then the documentation. It takes no input —
 * moving on, a key or a click puts it away.
 */
export function HoverCard({ card }: { card: Card }) {
  const { palette, screen } = useAppContext();
  const width = Math.min(MAX_WIDTH, screen.width - 2);
  const inner = width - 4;
  const code = useCodeColours(card.contents);
  const lines = cardLines(palette, card.contents, inner, code).slice(
    0,
    MAX_LINES,
  );
  const height = lines.length + 2;
  const below = card.at.y + height <= screen.height - 1;
  const top = below ? card.at.y : Math.max(1, card.at.y - height - 1);
  const left = Math.max(0, Math.min(card.at.x - 2, screen.width - width));
  const bg = palette.popover;

  return (
    <box
      position="absolute"
      left={left}
      top={top}
      width={width}
      height={height}
      zIndex={70}
      border
      borderStyle="rounded"
      borderColor={mix(bg, palette.muted, 0.5)}
      backgroundColor={bg}
      flexDirection="column"
    >
      {lines.map((segs, i) => (
        <Line
          key={i}
          segs={[{ text: ' ' }, ...segs]}
          width={width - 2}
          fill={bg}
        />
      ))}
    </box>
  );
}

/** Each fenced block's lines in syntax colours, once the highlighter answers. */
function useCodeColours(markdown: string): LineTokens[][] {
  const { themes } = useAppContext();
  const { theme, themeName } = themes.look;
  const [blocks, setBlocks] = React.useState<LineTokens[][]>([]);
  React.useEffect(() => {
    let cancelled = false;
    void Promise.all(
      fences(markdown).map((fence) =>
        highlightSnippet(fence.code, fence.language, theme, themeName),
      ),
    ).then((next) => !cancelled && setBlocks(next));
    return () => {
      cancelled = true;
    };
  }, [markdown, theme, themeName]);
  return blocks;
}

function fences(markdown: string): Array<{ language: string; code: string }> {
  return [...markdown.matchAll(/```(\w*)\n([\s\S]*?)```/g)].map((match) => ({
    language: match[1] || 'ts',
    code: match[2]!.replace(/\n$/, ''),
  }));
}

/** Markdown, read loosely: fenced code in code colours, prose wrapped and muted. */
function cardLines(
  palette: Palette,
  markdown: string,
  width: number,
  code: LineTokens[][],
): Seg[][] {
  const out: Seg[][] = [];
  let inCode = false;
  let block = -1;
  let row = 0;
  for (const raw of markdown.split('\n')) {
    if (raw.trimStart().startsWith('```')) {
      inCode = !inCode;
      if (inCode) {
        block += 1;
        row = 0;
      }
      continue;
    }
    if (inCode) {
      const tokens = code[block]?.[row];
      row += 1;
      out.push(
        tokens
          ? tokens.map((token) => ({
              text: token.text,
              fg: token.color ?? palette.text,
              bold: token.bold,
              italic: token.italic,
            }))
          : [{ text: raw, fg: palette.text }],
      );
      continue;
    }
    const text = raw.replace(/\*\*|__|`/g, '').replace(/^#+\s*/, '');
    if (!text.trim()) {
      if (out.length > 0 && out.at(-1)!.length > 0) out.push([]);
      continue;
    }
    for (const line of wrapProse(text, width))
      out.push([{ text: line, fg: palette.muted }]);
  }
  while (out.length > 0 && out.at(-1)!.length === 0) out.pop();
  return out;
}
