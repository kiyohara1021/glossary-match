import { formatPromptSection, lintGlossary, matchGlossary } from "../src/index.js";
import type { Glossary, GlossaryEntry, GlossaryMatchResult, MatchOptions, NormalizationForm, TermOccurrence } from "../src/index.js";

const SAMPLE_TEXT = "黒龍討伐戦の後、黒龍が現れた。TAC team starts the next quest.";
const SAMPLE_GLOSSARY: Glossary = {
  entries: [
    { id: "black-dragon", aliases: ["黒龍", "Black Dragon"], translations: { en: "Black Dragon", ja: "黒龍" }, context: "A named boss, not a generic dragon." },
    { id: "black-dragon-hunt", aliases: ["黒龍討伐戦", "Black Dragon Hunt"], translations: { en: "Black Dragon Hunt", ja: "黒龍討伐戦" }, context: "A limited-time game event." },
    { id: "tactical-command", aliases: ["TAC"], translations: { en: "Tactical Command", ja: "戦術司令部" } },
  ],
};

function element<T extends HTMLElement>(id: string): T {
  const target = document.getElementById(id);
  if (!target) throw new Error(`Missing element: #${id}`);
  return target as T;
}

const sourceText = element<HTMLTextAreaElement>("source-text");
const glossaryJson = element<HTMLTextAreaElement>("glossary-json");
const localeInput = element<HTMLInputElement>("locale");
const normalizationSelect = element<HTMLSelectElement>("normalization");
const boundaryModeSelect = element<HTMLSelectElement>("boundary-mode");
const caseSensitiveInput = element<HTMLInputElement>("case-sensitive");
const includeTranslationsInput = element<HTMLInputElement>("include-translations");
const jsonStatus = element<HTMLSpanElement>("json-status");
const errorBox = element<HTMLDivElement>("error-box");
const resultContent = element<HTMLDivElement>("result-content");
const runState = element<HTMLSpanElement>("result-state");
const promptOutputCandidate = element<HTMLElement>("prompt-output").querySelector("code");
if (!promptOutputCandidate) throw new Error("Missing prompt output element");
const promptOutput = promptOutputCandidate;

function parseGlossary(): Glossary {
  const parsed: unknown = JSON.parse(glossaryJson.value);
  if (!parsed || typeof parsed !== "object" || !("entries" in parsed)) throw new Error('Glossary must be an object with an "entries" array.');
  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) throw new Error('"entries" must be an array.');
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object") throw new Error(`entries[${index}] must be an object.`);
    const candidate = entry as Partial<GlossaryEntry>;
    if (typeof candidate.id !== "string") throw new Error(`entries[${index}].id must be a string.`);
    if (!Array.isArray(candidate.aliases) || !candidate.aliases.every((term) => typeof term === "string")) throw new Error(`entries[${index}].aliases must be a string array.`);
    if (!candidate.translations || typeof candidate.translations !== "object") throw new Error(`entries[${index}].translations must be an object.`);
  }
  return parsed as Glossary;
}

function options(): MatchOptions {
  const value = normalizationSelect.value;
  const normalization: NormalizationForm = value === "false" ? false : value as Exclude<NormalizationForm, false>;
  return {
    normalization,
    caseSensitive: caseSensitiveInput.checked,
    includeTranslations: includeTranslationsInput.checked,
    boundaryMode: boundaryModeSelect.value as "auto" | "substring",
  };
}

function createCard(title: string, detail: string, tag?: string): HTMLElement {
  const card = document.createElement("div");
  card.className = "term-card";
  const copy = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = detail;
  copy.append(strong, small);
  card.append(copy);
  if (tag) {
    const code = document.createElement("code");
    code.textContent = tag;
    card.append(code);
  }
  return card;
}

function renderHighlightedText(result: GlossaryMatchResult): void {
  const target = element<HTMLDivElement>("highlighted-text");
  target.replaceChildren();
  const occurrences = result.matches.flatMap(({ occurrences: items }) => items).sort((a, b) => a.start - b.start || b.end - a.end);
  const spans: Array<{ start: number; end: number; occurrences: TermOccurrence[] }> = [];
  for (const occurrence of occurrences) {
    const existing = spans.find((span) => span.start === occurrence.start && span.end === occurrence.end);
    if (existing) existing.occurrences.push(occurrence);
    else spans.push({ start: occurrence.start, end: occurrence.end, occurrences: [occurrence] });
  }
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    target.append(document.createTextNode(result.normalizedText.slice(cursor, span.start)));
    const mark = document.createElement("mark");
    mark.textContent = result.normalizedText.slice(span.start, span.end);
    mark.title = span.occurrences.map(({ entryId }) => entryId).join(" / ");
    target.append(mark);
    cursor = span.end;
  }
  target.append(document.createTextNode(result.normalizedText.slice(cursor)));
}

function renderResults(glossary: Glossary, result: GlossaryMatchResult): void {
  element<HTMLElement>("match-count").textContent = String(result.matches.length);
  element<HTMLElement>("suppressed-count").textContent = String(result.suppressed.length);
  element<HTMLElement>("conflict-count").textContent = String(result.conflicts.length);
  renderHighlightedText(result);

  const matchList = element<HTMLDivElement>("match-list");
  matchList.replaceChildren();
  const locale = localeInput.value.trim() || "en";
  if (result.matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "一致する用語はありません";
    matchList.append(empty);
  } else {
    for (const { entry, occurrences } of result.matches) {
      const found = [...new Set(occurrences.map(({ term }) => term))].join(" / ");
      matchList.append(createCard(found, entry.context ?? entry.id, entry.translations[locale] ?? "No target translation"));
    }
  }

  const suppressedSection = element<HTMLElement>("suppressed-section");
  const suppressedList = element<HTMLDivElement>("suppressed-list");
  suppressedList.replaceChildren();
  suppressedSection.hidden = result.suppressed.length === 0;
  for (const item of result.suppressed) suppressedList.append(createCard(item.term, `contained by “${item.containedBy.term}” at ${item.start}:${item.end}`));

  const conflictSection = element<HTMLElement>("conflict-section");
  const conflictList = element<HTMLDivElement>("conflict-list");
  conflictList.replaceChildren();
  conflictSection.hidden = result.conflicts.length === 0;
  for (const conflict of result.conflicts) conflictList.append(createCard(result.normalizedText.slice(conflict.start, conflict.end), conflict.occurrences.map(({ entryId }) => entryId).join(" ↔ ")));

  const lintIssues = lintGlossary(glossary);
  const lintSection = element<HTMLElement>("lint-section");
  const lintList = element<HTMLDivElement>("lint-list");
  lintList.replaceChildren();
  lintSection.hidden = lintIssues.length === 0;
  for (const issue of lintIssues) lintList.append(createCard(issue.code, issue.message, issue.severity));

  promptOutput.textContent = formatPromptSection(result, locale) || "# No translated terms matched";
}

function run(): void {
  try {
    const glossary = parseGlossary();
    const result = matchGlossary(sourceText.value, glossary, options());
    jsonStatus.textContent = "Valid JSON";
    jsonStatus.classList.remove("invalid");
    errorBox.hidden = true;
    resultContent.hidden = false;
    runState.textContent = "Updated";
    renderResults(glossary, result);
  } catch (error) {
    jsonStatus.textContent = "Check input";
    jsonStatus.classList.add("invalid");
    errorBox.textContent = error instanceof Error ? error.message : "Unknown error";
    errorBox.hidden = false;
    resultContent.hidden = true;
    runState.textContent = "Error";
  }
}

function loadSample(): void {
  sourceText.value = SAMPLE_TEXT;
  glossaryJson.value = JSON.stringify(SAMPLE_GLOSSARY, null, 2);
  localeInput.value = "en";
  normalizationSelect.value = "NFKC";
  boundaryModeSelect.value = "auto";
  caseSensitiveInput.checked = false;
  includeTranslationsInput.checked = true;
  run();
}

let debounceTimer: number | undefined;
function scheduleRun(): void {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(run, 260);
}

element<HTMLButtonElement>("run-match").addEventListener("click", run);
element<HTMLButtonElement>("load-sample").addEventListener("click", loadSample);
element<HTMLButtonElement>("copy-prompt").addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  await navigator.clipboard.writeText(promptOutput.textContent ?? "");
  button.textContent = "Copied";
  window.setTimeout(() => { button.textContent = "Copy"; }, 1200);
});
for (const control of [sourceText, glossaryJson, localeInput, normalizationSelect, boundaryModeSelect, caseSensitiveInput, includeTranslationsInput]) {
  control.addEventListener("input", scheduleRun);
  control.addEventListener("change", scheduleRun);
}
loadSample();
