import { normalizeText } from "./normalize.js";
import type { Glossary, GlossaryEntry, LintIssue, MatchOptions } from "./types.js";

interface AliasOwner {
  entry: GlossaryEntry;
  term: string;
  normalized: string;
}

export function lintGlossary(
  glossary: Glossary | GlossaryEntry[],
  options: MatchOptions = {},
): LintIssue[] {
  const entries = Array.isArray(glossary) ? glossary : glossary.entries;
  const issues: LintIssue[] = [];
  const ids = new Map<string, number>();
  const owners: AliasOwner[] = [];

  for (const entry of entries) {
    if (entry.id.trim().length === 0) {
      issues.push({ severity: "error", code: "empty-entry-id", message: "Entry id is empty.", entryIds: [entry.id] });
    }

    ids.set(entry.id, (ids.get(entry.id) ?? 0) + 1);

    if (entry.aliases.length === 0) {
      issues.push({
        severity: "error",
        code: "missing-alias",
        message: `Entry "${entry.id}" has no aliases.`,
        entryIds: [entry.id],
      });
    }

    for (const term of entry.aliases) {
      const normalized = normalizeText(term, options);
      if (normalized.trim().length === 0) {
        issues.push({
          severity: "error",
          code: "empty-alias",
          message: `Entry "${entry.id}" contains an empty alias.`,
          entryIds: [entry.id],
        });
      } else {
        owners.push({ entry, term, normalized });
      }
    }
  }

  for (const [id, count] of ids) {
    if (count > 1) {
      issues.push({
        severity: "error",
        code: "duplicate-entry-id",
        message: `Entry id "${id}" is used ${count} times.`,
        entryIds: [id],
      });
    }
  }

  const byAlias = new Map<string, AliasOwner[]>();
  for (const owner of owners) {
    const current = byAlias.get(owner.normalized) ?? [];
    current.push(owner);
    byAlias.set(owner.normalized, current);
  }

  for (const group of byAlias.values()) {
    const entryIds = [...new Set(group.map(({ entry }) => entry.id))];
    if (entryIds.length > 1) {
      issues.push({
        severity: "warning",
        code: "duplicate-alias",
        message: `Alias "${group[0]?.term ?? ""}" belongs to multiple entries: ${entryIds.join(", ")}.`,
        entryIds,
        terms: [...new Set(group.map(({ term }) => term))],
      });
    }
  }

  const nestedKeys = new Set<string>();
  for (const shorter of owners) {
    for (const longer of owners) {
      if (
        shorter.entry.id === longer.entry.id ||
        shorter.normalized.length >= longer.normalized.length ||
        !longer.normalized.includes(shorter.normalized)
      ) {
        continue;
      }

      const key = `${shorter.entry.id}\0${longer.entry.id}\0${shorter.normalized}\0${longer.normalized}`;
      if (nestedKeys.has(key)) continue;
      nestedKeys.add(key);
      issues.push({
        severity: "warning",
        code: "nested-alias",
        message: `Alias "${shorter.term}" is contained in "${longer.term}" from another entry. Runtime matching will prefer the longer occurrence.`,
        entryIds: [shorter.entry.id, longer.entry.id],
        terms: [shorter.term, longer.term],
      });
    }
  }

  return issues;
}
