import { describe, expect, test } from 'bun:test';
import { parseDiff, unquotePath } from './parseDiff';

describe('parseDiff', () => {
  test('numbers lines on both sides', () => {
    const [file] = parseDiff(
      [
        'diff --git a/src/a.ts b/src/a.ts',
        '--- a/src/a.ts',
        '+++ b/src/a.ts',
        '@@ -1,3 +1,4 @@ function top()',
        ' one',
        '-two',
        '+TWO',
        '+three',
        ' four',
        '\\ No newline at end of file',
        '',
      ].join('\n'),
    );
    expect(file?.path).toBe('src/a.ts');
    expect(file?.status).toBe('modified');
    expect([file?.additions, file?.deletions]).toEqual([2, 1]);
    expect(file?.hunks[0]?.section).toBe('function top()');
    expect(
      file?.hunks[0]?.lines.map((l) => [l.kind, l.oldNo, l.newNo]),
    ).toEqual([
      ['context', 1, 1],
      ['del', 2, null],
      ['add', null, 2],
      ['add', null, 3],
      ['context', 3, 4],
    ]);
  });

  test('reads added, deleted, renamed and binary files', () => {
    const files = parseDiff(
      [
        'diff --git a/new.txt b/new.txt',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/new.txt',
        '@@ -0,0 +1 @@',
        '+hello',
        'diff --git a/gone.txt b/gone.txt',
        'deleted file mode 100644',
        '--- a/gone.txt',
        '+++ /dev/null',
        '@@ -1 +0,0 @@',
        '-bye',
        'diff --git a/old name.ts b/new name.ts',
        'similarity index 100%',
        'rename from old name.ts',
        'rename to new name.ts',
        'diff --git a/img.png b/img.png',
        'Binary files a/img.png and b/img.png differ',
      ].join('\n'),
    );
    expect(files.map((f) => [f.path, f.status, f.oldPath, f.binary])).toEqual([
      ['new.txt', 'added', null, false],
      ['gone.txt', 'deleted', null, false],
      ['new name.ts', 'renamed', 'old name.ts', false],
      ['img.png', 'modified', null, true],
    ]);
  });

  test('keeps header-looking lines inside a hunk and expands tabs', () => {
    const [file] = parseDiff(
      [
        'diff --git a/x b/x',
        '--- a/x',
        '+++ b/x',
        '@@ -1,2 +1,2 @@',
        '--- a',
        '+\tb',
        ' c',
      ].join('\n'),
    );
    expect(file?.hunks[0]?.lines.map((l) => l.text)).toEqual([
      '-- a',
      '    b',
      'c',
    ]);
  });
});

describe('unquotePath', () => {
  test('decodes C-style quoting', () => {
    expect(unquotePath('"caf\\303\\251 \\"x\\".txt"')).toBe('café "x".txt');
    expect(unquotePath('plain.txt')).toBe('plain.txt');
  });
});
