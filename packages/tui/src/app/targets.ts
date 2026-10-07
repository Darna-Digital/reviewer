import type { Branch, Divergence } from '../git/refs';

export type TargetReason = 'target' | 'default' | 'upstream' | 'recent';

export interface TargetOption {
  /** `null` is the uncommitted work. */
  ref: string | null;
  group: 'Suggested' | 'Local' | 'Remote';
  reasons: TargetReason[];
}

export interface TargetInputs {
  branches: Branch[];
  current: string | null;
  aim: string | null;
  defaultBranch: string | null;
  recent: string[];
}

/**
 * Everything the diff can be read against: the likely picks first (the
 * branch's target, the default branch, its upstream, recent picks), then
 * every other local and remote branch.
 */
export function buildTargetOptions(inputs: TargetInputs): TargetOption[] {
  const { branches, current, aim, defaultBranch, recent } = inputs;
  const known = new Set(branches.map((branch) => branch.name));
  const upstream =
    branches.find((branch) => branch.name === current)?.upstream ?? null;

  const suggested = new Map<string, TargetReason[]>();
  const suggest = (ref: string | null, reason: TargetReason) => {
    if (!ref || ref === current || !known.has(ref)) return;
    suggested.set(ref, [...(suggested.get(ref) ?? []), reason]);
  };
  suggest(aim, 'target');
  suggest(defaultBranch, 'default');
  suggest(upstream, 'upstream');
  for (const ref of recent) suggest(ref, 'recent');

  const rest = branches.filter(
    (branch) => branch.name !== current && !suggested.has(branch.name),
  );
  return [
    { ref: null, group: 'Suggested', reasons: [] },
    ...[...suggested].map(([ref, reasons]): TargetOption => ({
      ref,
      group: 'Suggested',
      reasons,
    })),
    ...rest.map((branch): TargetOption => ({
      ref: branch.name,
      group: branch.remote ? 'Remote' : 'Local',
      reasons: [],
    })),
  ];
}

export const REASON_LABEL: Record<TargetReason, string> = {
  target: '◎ target',
  default: 'default',
  upstream: 'upstream',
  recent: 'recent',
};

export function describeDivergence(divergence: Divergence | undefined): string {
  if (!divergence) return '';
  const parts = [];
  if (divergence.ahead > 0) parts.push(`↑${divergence.ahead}`);
  if (divergence.behind > 0) parts.push(`↓${divergence.behind}`);
  return parts.length > 0 ? parts.join(' ') : 'even';
}
