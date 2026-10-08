import { describe, expect, test } from 'bun:test';
import { TOKEN_GLYPHS } from './fileIconGlyphs';
import { resolveFileIcon } from './fileIcons';

function glyphOf(token: string) {
  return TOKEN_GLYPHS[token];
}

describe('resolveFileIcon', () => {
  test('follows the Mac tree: React for tsx, TypeScript for ts', () => {
    expect(resolveFileIcon('src/App.tsx')).toEqual({
      glyph: glyphOf('react')!,
      hue: 'cyan',
    });
    expect(resolveFileIcon('src/index.ts').glyph).toBe(glyphOf('typescript')!);
  });

  test('a whole name wins over its extension', () => {
    expect(resolveFileIcon('.gitignore').glyph).toBe(glyphOf('git')!);
    expect(resolveFileIcon('app/vite.config.ts').glyph).toBe(glyphOf('vite')!);
  });

  test('the longest extension wins', () => {
    expect(resolveFileIcon('views/home.blade.php').glyph).toBe(
      glyphOf('blade')!,
    );
  });

  test('names are matched case-insensitively', () => {
    expect(resolveFileIcon('Dockerfile').glyph).toBe(glyphOf('docker')!);
  });

  test('types the Mac leaves plain still get a glyph', () => {
    expect(resolveFileIcon('Main.java').hue).toBe('red');
    expect(resolveFileIcon('Makefile').hue).toBe('gray');
  });

  test('anything else is the plain document', () => {
    expect(resolveFileIcon('notes.unknownext')).toEqual({
      glyph: glyphOf('default')!,
      hue: 'gray',
    });
  });
});
