import { describe, expect, test } from 'bun:test';
import { buildTree } from '../tree/fileTree';
import { byRepo, inRepo, locate, reposOf } from './repos';

describe('reposOf', () => {
  test('numbers repositories that share a folder name, as the Mac tree does', () => {
    const repos = reposOf(['/a/web', '/b/api', '/c/web']);
    expect(repos.list.map((repo) => repo.name)).toEqual([
      'web',
      'api',
      'web 2',
    ]);
    expect(repos.spans).toBe(true);
  });
});

describe('workspace paths', () => {
  const one = reposOf(['/code/app']);
  const two = reposOf(['/code/web', '/code/api']);

  test('one repository keeps its own paths', () => {
    expect(inRepo(one, one.list[0]!, 'src/a.ts')).toBe('src/a.ts');
    expect(locate(one, 'src/a.ts')).toEqual({
      repo: one.list[0]!,
      path: 'src/a.ts',
    });
  });

  test('several lead each path with the repository name, and back', () => {
    const api = two.list[1]!;
    expect(inRepo(two, api, 'src/a.ts')).toBe('api/src/a.ts');
    expect(locate(two, 'api/src/a.ts')).toEqual({
      repo: api,
      path: 'src/a.ts',
    });
  });

  test('groups paths by repository in workspace order', () => {
    expect(
      byRepo(two, ['api/b.ts', 'web/a.ts', 'api/c.ts']).map((group) => [
        group.repo.name,
        group.paths,
      ]),
    ).toEqual([
      ['web', ['a.ts']],
      ['api', ['b.ts', 'c.ts']],
    ]);
  });
});

describe('a workspace tree', () => {
  test('leads with the repositories in order, never folding them', () => {
    const tree = buildTree(
      [{ path: 'web/src/a.ts' }, { path: 'api/src/b.ts' }],
      ['web', 'api'],
    );
    expect(tree.map((node) => [node.path, node.name])).toEqual([
      ['web', 'web'],
      ['api', 'api'],
    ]);
    expect(tree[0]!.children[0]!.name).toBe('src');
  });
});
