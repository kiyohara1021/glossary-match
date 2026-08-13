export { lintGlossary } from "./lint.js";
export { matchGlossary } from "./matcher.js";
export { findOccurrences, normalizeText } from "./normalize.js";
export { formatPromptSection } from "./prompt.js";
export type {
  Glossary,
  GlossaryEntry,
  GlossaryMatchResult,
  LintIssue,
  MatchConflict,
  MatchedEntry,
  MatchOptions,
  NormalizationForm,
  SuppressedOccurrence,
  TermOccurrence,
} from "./types.js";
