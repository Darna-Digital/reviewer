/** Issue keys like `RVW-12` keep their case: commit messages read them back from the branch. */
const ISSUE_KEY = /^[A-Z][A-Z0-9]*-\d+$/;

/**
 * Turns free text into a usable branch name, `/` kept as the folder
 * separator: `Connect the new onboarding flow` → `connect-the-new-onboarding-flow`.
 */
export function branchName(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split('/')
    .map(segment)
    .filter(Boolean)
    .join('/');
}

function segment(text: string): string {
  return text
    .split(/[^A-Za-z0-9._-]+/)
    .filter(Boolean)
    .map((word) => (ISSUE_KEY.test(word) ? word : word.toLowerCase()))
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/\.lock$/, '')
    .replace(/^[.-]+|[.-]+$/g, '');
}
