export type NormalizationForm = "NFC" | "NFD" | "NFKC" | "NFKD" | false;

export interface GlossaryEntry {
  id: string;
  aliases: string[];
  translations: Record<string, string>;
  context?: string;
}

export interface Glossary {
  entries: GlossaryEntry[];
}

export interface MatchOptions {
  /** Unicode normalization applied before matching. Defaults to NFKC. */
  normalization?: NormalizationForm;
  /** Preserve case while matching. Defaults to false. */
  caseSensitive?: boolean;
  /** Also treat translated labels as input aliases. Defaults to true. */
  includeTranslations?: boolean;
  /** Apply Latin/digit word boundaries, or match every term as a substring. */
  boundaryMode?: "auto" | "substring";
}

export interface TermOccurrence {
  entryId: string;
  term: string;
  normalizedTerm: string;
  /** UTF-16 offset in normalizedText. */
  start: number;
  /** Exclusive UTF-16 offset in normalizedText. */
  end: number;
}

export interface SuppressedOccurrence extends TermOccurrence {
  reason: "contained-by-longer-term";
  containedBy: TermOccurrence;
}

export interface MatchedEntry {
  entry: GlossaryEntry;
  occurrences: TermOccurrence[];
}

export interface MatchConflict {
  start: number;
  end: number;
  occurrences: TermOccurrence[];
}

export interface GlossaryMatchResult {
  normalizedText: string;
  matches: MatchedEntry[];
  suppressed: SuppressedOccurrence[];
  conflicts: MatchConflict[];
}

export type LintSeverity = "error" | "warning";

export interface LintIssue {
  severity: LintSeverity;
  code:
    | "duplicate-entry-id"
    | "empty-entry-id"
    | "empty-alias"
    | "missing-alias"
    | "duplicate-alias"
    | "nested-alias";
  message: string;
  entryIds: string[];
  terms?: string[];
}
