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

function findConflicts(occurrences: TermOccurrence[]): MatchConflict[] {
  const bySpan = new Map<string, TermOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.start}:${occurrence.end}`;
    const current = bySpan.get(key) ?? [];
    current.push(occurrence);
    bySpan.set(key, current);
  }

  return [...bySpan.values()].flatMap((items) => {
    if (new Set(items.map((item) => item.entryId)).size < 2) return [];
    const first = items[0];
    return first ? [{ start: first.start, end: first.end, occurrences: items }] : [];
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
