import * as React from 'react';
import type { Overlay } from '../app/useApp';
import {
  buildTargetOptions,
  describeDivergence,
  REASON_LABEL,
} from '../app/targets';
import type { TargetOption } from '../app/targets';
import { divergence } from '../git/refs';
import type { Divergence } from '../git/refs';
import type { Seg } from '../render/styled';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';
import type { PickerOption } from './Picker';

const UNCOMMITTED = 'uncommitted';
/** No ref holds a space, so this key cannot clash with a branch. */
const PULL_REQUESTS = ' pull requests';

/**
 * Picks what the diff is read against. Likely targets come first with how far
 * HEAD has moved from each; `ctrl+r` (or clicking the toggle) also records
 * the pick as the branch's target, which the Mac app opens on too.
 */
export function TargetPicker({
  overlay,
}: {
  overlay: Extract<Overlay, { kind: 'targets' }>;
}) {
  const app = useAppContext();
  const { palette, review, actions } = app;
  const current = review.repo?.branch ?? null;
  const [remember, setRemember] = React.useState(false);
  const [divergences, setDivergences] = React.useState<
    Record<string, Divergence>
  >({});

  const targets = React.useMemo(
    () =>
      buildTargetOptions({
        branches: review.branches,
        current,
        aim: review.aim,
        defaultBranch: review.defaultBranch,
        recent: review.recent,
      }),
    [review.branches, current, review.aim, review.defaultBranch, review.recent],
  );

  React.useEffect(() => {
    let cancelled = false;
    const suggested = targets
      .filter((t) => t.group === 'Suggested' && t.ref)
      .map((t) => t.ref!);
    void Promise.all(
      suggested.map(
        async (ref) => [ref, await divergence(review.root, ref)] as const,
      ),
    ).then((entries) => {
      if (cancelled) return;
      setDivergences(
        Object.fromEntries(
          entries.filter(
            (entry): entry is [string, Divergence] => entry[1] !== null,
          ),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [targets, review.root]);

  const showing =
    review.comparison.kind === 'branch' ? review.comparison.against : null;
  const branchOptions = targets.map((target): PickerOption => ({
    key: target.ref ?? UNCOMMITTED,
    label: target.ref ?? 'Uncommitted changes',
    group: target.group,
    hint: hintFor(target),
    hintColor: target.reasons.includes('target')
      ? palette.accent
      : palette.faint,
    labelColor: target.ref === null ? palette.text : undefined,
  }));
  const options: PickerOption[] = [
    ...branchOptions,
    {
      key: PULL_REQUESTS,
      label: 'Pull requests…',
      group: 'GitHub',
      hint: review.comparison.kind === 'pull' ? '● showing · M' : 'M',
    },
  ];

  const footer: Seg[] = current
    ? [
        {
          text: remember ? ' [✓] ' : ' [ ] ',
          fg: remember ? palette.accent : palette.muted,
          bold: true,
        },
        { text: 'remember as the target of ', fg: palette.muted },
        { text: current, fg: palette.text, bold: true },
        { text: '   ^r', fg: palette.faint },
      ]
    : [];

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      anchor={overlay.at}
      width={72}
      title={current ? `Compare ${current} against` : 'Compare against'}
      placeholder="Search branches…"
      options={options}
      footer={current ? footer : undefined}
      onFooterPress={() => setRemember((on) => !on)}
      onKey={(key) => {
        if (key !== 'ctrl+r' || !current) return false;
        setRemember((on) => !on);
        return true;
      }}
      onClose={actions.closeOverlay}
      onPick={(option) => {
        if (option.key === PULL_REQUESTS) return actions.openPulls();
        actions.closeOverlay();
        actions.pickTarget(
          option.key === UNCOMMITTED ? null : option.key,
          remember,
        );
      }}
    />
  );

  function hintFor(target: TargetOption): string {
    if (target.ref === null) {
      return review.comparison.kind === 'worktree'
        ? '● showing'
        : 'HEAD → working tree';
    }
    const parts = [
      target.ref === showing ? '● showing' : '',
      ...target.reasons.map((reason) => REASON_LABEL[reason]),
      describeDivergence(divergences[target.ref]),
    ];
    return parts.filter(Boolean).join(' · ');
  }
}
