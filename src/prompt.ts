import type { GlossaryMatchResult } from "./types.js";

export function formatPromptSection(result: GlossaryMatchResult, locale: string): string {
  const lines = result.matches.flatMap(({ entry, occurrences }) => {
    const target = entry.translations[locale];
    if (!target) return [];
    const terms = [...new Set(occurrences.map(({ term }) => term))];
    const termLine = `- ${terms.join(" / ")} → ${target}`;
    return entry.context ? [termLine, `  Context: ${entry.context}`] : [termLine];
  });

  return lines.length > 0 ? ["Terms:", ...lines, ""].join("\n") : "";
}
