import { describe, expect, test } from 'bun:test';
import { isNewer } from './install';

describe('isNewer', () => {
  test('compares versions part by part, not as text', () => {
    expect(isNewer('0.0.40', '0.0.39')).toBe(true);
    expect(isNewer('0.0.10', '0.0.9')).toBe(true);
    expect(isNewer('0.0.39', '0.0.39')).toBe(false);
    expect(isNewer('0.0.38', '0.0.39')).toBe(false);
  });

  test('a build that is not a release is never behind', () => {
    expect(isNewer('0.0.40', 'dev')).toBe(false);
  });
});
