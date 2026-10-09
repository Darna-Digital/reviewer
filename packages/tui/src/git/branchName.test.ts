import { describe, expect, test } from 'bun:test';
import { branchName } from './branchName';

describe('branchName', () => {
  test('slugifies a sentence', () => {
    expect(branchName('connect the new onboarding flow to the backend')).toBe(
      'connect-the-new-onboarding-flow-to-the-backend',
    );
  });

  test('lowercases words but keeps issue keys', () => {
    expect(branchName('RVW-12 Fix the Login')).toBe('RVW-12-fix-the-login');
  });

  test('keeps folders and drops empty ones', () => {
    expect(branchName(' feat / new  thing/ ')).toBe('feat/new-thing');
  });

  test('strips accents and punctuation', () => {
    expect(branchName('Rūtenis’s café: fix?!')).toBe('rutenis-s-cafe-fix');
  });

  test('leaves names git would refuse out', () => {
    expect(branchName('.hidden..name.lock')).toBe('hidden.name');
    expect(branchName('~^:?*[\\')).toBe('');
  });

  test('leaves a valid name alone', () => {
    expect(branchName('fix/diff-gaps_v2.1')).toBe('fix/diff-gaps_v2.1');
  });
});
