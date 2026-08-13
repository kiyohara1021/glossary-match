import type { MatchOptions, NormalizationForm } from "./types.js";

const DEFAULT_NORMALIZATION: NormalizationForm = "NFKC";

export function normalizeText(value: string, options: MatchOptions = {}): string {
  const form = options.normalization ?? DEFAULT_NORMALIZATION;
  const normalized = form === false ? value : value.normalize(form);
  // Unlike toLocaleLowerCase(), this does not vary with the host locale.
  return options.caseSensitive ? normalized : normalized.toLowerCase();
}

const LATIN_OR_NUMBER = /^(?:\p{Script=Latin}|\p{Number})$/u;

function isLatinOrNumber(character: string): boolean {
  return character.length > 0 && LATIN_OR_NUMBER.test(character);
}

function codePointAt(value: string, offset: number): string {
  const point = value.codePointAt(offset);
  return point === undefined ? "" : String.fromCodePoint(point);
}

function codePointBefore(value: string, offset: number): string {
  if (offset <= 0) return "";

  let start = offset - 1;
  const lastUnit = value.charCodeAt(start);
  if (lastUnit >= 0xdc00 && lastUnit <= 0xdfff && start > 0) {
    const previousUnit = value.charCodeAt(start - 1);
    if (previousUnit >= 0xd800 && previousUnit <= 0xdbff) start -= 1;
  }

  return value.slice(start, offset);
}

export function findOccurrences(
  normalizedText: string,
  normalizedTerm: string,
  options: MatchOptions = {},
): Array<[number, number]> {
  if (normalizedTerm.length === 0) return [];

  const boundaryMode = options.boundaryMode ?? "auto";
  const first = codePointAt(normalizedTerm, 0);
  const last = codePointBefore(normalizedTerm, normalizedTerm.length);
  const boundStart = boundaryMode === "auto" && isLatinOrNumber(first);
  const boundEnd = boundaryMode === "auto" && isLatinOrNumber(last);
  const occurrences: Array<[number, number]> = [];

  let start = normalizedText.indexOf(normalizedTerm);
  while (start !== -1) {
    const end = start + normalizedTerm.length;
    const before = codePointBefore(normalizedText, start);
    const after = codePointAt(normalizedText, end);

    if ((!boundStart || !isLatinOrNumber(before)) && (!boundEnd || !isLatinOrNumber(after))) {
      occurrences.push([start, end]);
    }

    start = normalizedText.indexOf(normalizedTerm, start + 1);
  }

  return occurrences;
}
