import { findOccurrences, normalizeText } from "./normalize.js";
import type {
  Glossary,
  GlossaryEntry,
  GlossaryMatchResult,
  MatchConflict,
  MatchedEntry,
  MatchOptions,
  SuppressedOccurrence,
  TermOccurrence,
} from "./types.js";

function termsForEntry(entry: GlossaryEntry, options: MatchOptions): string[] {
  const includeTranslations = options.includeTranslations ?? true;
  const candidates = includeTranslations
    ? [...entry.aliases, ...Object.values(entry.translations)]
    : entry.aliases;
  const seen = new Set<string>();

  return candidates.filter((term) => {
    const normalized = normalizeText(term, options);
    if (normalized.length === 0 || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function collectOccurrences(
  normalizedText: string,
  entries: GlossaryEntry[],
  options: MatchOptions,
): TermOccurrence[] {
  return entries.flatMap((entry) =>
    termsForEntry(entry, options).flatMap((term) => {
      const normalizedTerm = normalizeText(term, options);
      return findOccurrences(normalizedText, normalizedTerm, options).map(([start, end]) => ({
        entryId: entry.id,
        term,
        normalizedTerm,
        start,
        end,
      }));
    }),
  );
}

function suppressContained(occurrences: TermOccurrence[]): {
  active: TermOccurrence[];
  suppressed: SuppressedOccurrence[];
} {
  const active: TermOccurrence[] = [];
  const suppressed: SuppressedOccurrence[] = [];

  for (const occurrence of occurrences) {
    const containers = occurrences
      .filter(
        (other) =>
          other.normalizedTerm.length > occurrence.normalizedTerm.length &&
          other.start <= occurrence.start &&
          occurrence.end <= other.end,
      )
      .sort((a, b) => b.normalizedTerm.length - a.normalizedTerm.length);

    const containedBy = containers[0];
    if (containedBy) {
      suppressed.push({
        ...occurrence,
        reason: "contained-by-longer-term",
        containedBy,
      });
    } else {
      active.push(occurrence);
    }
  }

  return { active, suppressed };
}

function groupMatches(entries: GlossaryEntry[], occurrences: TermOccurrence[]): MatchedEntry[] {
  const byEntry = new Map<string, TermOccurrence[]>();
  for (const occurrence of occurrences) {
    const current = byEntry.get(occurrence.entryId) ?? [];
    current.push(occurrence);
    byEntry.set(occurrence.entryId, current);
  }

  return entries.flatMap((entry) => {
    const entryOccurrences = byEntry.get(entry.id);
    return entryOccurrences ? [{ entry, occurrences: entryOccurrences }] : [];
  });
}

/**
 * Groups active occurrences whose spans overlap and reports groups that involve more than
 * one entry. Like same-span conflicts, partial overlaps are reported, not resolved: the
 * glossary cannot tell which reading of the text is meant.
 */
function findConflicts(occurrences: TermOccurrence[]): MatchConflict[] {
  const sorted = [...occurrences].sort((a, b) => a.start - b.start || a.end - b.end);
  const groups: TermOccurrence[][] = [];
  let groupEnd = -1;
  for (const occurrence of sorted) {
    const current = groups[groups.length - 1];
    if (current && occurrence.start < groupEnd) {
      current.push(occurrence);
      groupEnd = Math.max(groupEnd, occurrence.end);
    } else {
      groups.push([occurrence]);
      groupEnd = occurrence.end;
    }
  }

  return groups.flatMap((items) => {
    if (new Set(items.map((item) => item.entryId)).size < 2) return [];
    const start = Math.min(...items.map((item) => item.start));
    const end = Math.max(...items.map((item) => item.end));
    const sameSpan = items.every((item) => item.start === start && item.end === end);
    // Keep the input order of entries inside a conflict, as before.
    const ordered = occurrences.filter((occurrence) => items.includes(occurrence));
    return [{ kind: sameSpan ? "same-span" : "overlap", start, end, occurrences: ordered }];
  });
}

export function matchGlossary(
  text: string,
  glossary: Glossary | GlossaryEntry[],
  options: MatchOptions = {},
): GlossaryMatchResult {
  const entries = Array.isArray(glossary) ? glossary : glossary.entries;
  const normalizedText = normalizeText(text, options);
  const occurrences = collectOccurrences(normalizedText, entries, options);
  const { active, suppressed } = suppressContained(occurrences);

  return {
    normalizedText,
    matches: groupMatches(entries, active),
    suppressed,
    conflicts: findConflicts(active),
  };
}
