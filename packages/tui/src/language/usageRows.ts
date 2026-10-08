import type {
  ReferenceKind,
  ReferencesResult,
  SymbolReference,
} from './client';

export type UsageRow =
  | { kind: 'category'; label: string; count: number }
  | { kind: 'file'; path: string; count: number }
  | { kind: 'usage'; reference: SymbolReference };

const CATEGORIES: Array<{ kind: ReferenceKind; label: string }> = [
  { kind: 'definition', label: 'Declaration' },
  { kind: 'read', label: 'Usages' },
  { kind: 'write', label: 'Value write' },
  { kind: 'import', label: 'Usage in import' },
  { kind: 'export', label: 'Usage in export' },
];

/**
 * The find-usages tree as the Mac app groups it — category, then file, then
 * each usage — flattened into rows. The declaration category takes the
 * symbol's own kind when the provider names it ("Function", "Class").
 */
export function usageRows(result: ReferencesResult): UsageRow[] {
  const rows: UsageRow[] = [];
  for (const { kind, label } of CATEGORIES) {
    const references = result.references.filter((ref) => ref.kind === kind);
    if (references.length === 0) continue;
    rows.push({
      kind: 'category',
      label:
        kind === 'definition' && result.declaration?.kind
          ? capitalize(result.declaration.kind)
          : label,
      count: references.length,
    });
    for (const path of [...new Set(references.map((r) => r.location.path))]) {
      const inFile = references.filter((r) => r.location.path === path);
      rows.push({ kind: 'file', path, count: inFile.length });
      for (const reference of inFile) rows.push({ kind: 'usage', reference });
    }
  }
  return rows;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
