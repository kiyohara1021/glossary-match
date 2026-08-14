# glossary-match

[![CI](https://github.com/kiyohara1021/glossary-match/actions/workflows/ci.yml/badge.svg)](https://github.com/kiyohara1021/glossary-match/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/glossary-match.svg)](https://www.npmjs.com/package/glossary-match)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[日本語](README.ja.md)

**[Try the browser playground →](https://kiyohara1021.github.io/glossary-match/)** — no install, API key, or upload required.

Deterministic, CJK-friendly glossary matching for translation pipelines and LLM prompts.

`glossary-match` finds terms before text reaches an AI model. It does not tokenize Japanese, guess semantic equivalents, or call an API. CJK terms use substring matching, Latin terms use word boundaries, and a shorter occurrence is suppressed when it is fully covered by a longer matched term.

```text
Input: 黒龍討伐戦が始まる

Before: 黒龍 → Black Dragon
        黒龍討伐戦 → Black Dragon Hunt

After:  黒龍討伐戦 → Black Dragon Hunt
```

This avoids contradictory prompt instructions while keeping the result fast, explainable, and independent of any translation provider.

## Features

- CJK-friendly substring matching without morphological dictionaries
- Automatic Latin and numeric word boundaries (`TAC` does not match `attack`)
- Longest-occurrence preference with per-occurrence containment
- The short term survives when it also appears elsewhere on its own
- NFKC normalization and case-insensitive matching by default
- Conflict and suppression explanations
- Glossary linting for duplicate IDs, duplicate aliases, and nested aliases
- Zero runtime dependencies
- TypeScript API and CLI
- Interactive, local-only browser playground

## Install

```bash
npm install glossary-match
```

Or run the CLI directly from a checkout:

```bash
npm install
npm run build
node dist/cli.js --help
```

## 30-second quick start

Create a glossary:

```json
{
  "entries": [
    {
      "id": "black-dragon",
      "aliases": ["黒龍", "Black Dragon"],
      "translations": { "en": "Black Dragon", "ja": "黒龍" }
    },
    {
      "id": "black-dragon-hunt",
      "aliases": ["黒龍討伐戦", "Black Dragon Hunt"],
      "translations": { "en": "Black Dragon Hunt", "ja": "黒龍討伐戦" },
      "context": "A limited-time game event."
    }
  ]
}
```

Match text and print an LLM-ready prompt section:

```bash
glossary-match match \
  --glossary examples/glossary.json \
  --text "黒龍討伐戦が始まる" \
  --locale en
```

```text
Terms:
- 黒龍討伐戦 → Black Dragon Hunt
  Context: A limited-time game event, not a generic dragon hunt.
Suppressed: 黒龍 (contained by 黒龍討伐戦)
```

Use `--json` for structured matches, suppressions, conflicts, and normalized offsets.

Lint the same glossary with:

```bash
glossary-match lint --glossary examples/glossary.json
```

Lint errors produce exit code `1`; warnings alone produce `0`. Invalid CLI usage produces `2`.

## Library API

```ts
import { formatPromptSection, matchGlossary } from "glossary-match";

const result = matchGlossary("黒龍討伐戦の後、黒龍が現れた", glossary);

console.log(result.matches.map(({ entry }) => entry.id));
// ["black-dragon", "black-dragon-hunt"]

console.log(result.suppressed);
// The 黒龍 occurrence inside 黒龍討伐戦 is explained here.

console.log(formatPromptSection(result, "en"));
```

The `start` and `end` fields are UTF-16 offsets into `result.normalizedText`. They intentionally refer to the normalized string because NFKC may change the original string length.

### Matching options

```ts
matchGlossary(text, glossary, {
  normalization: "NFKC",      // NFC, NFD, NFKC, NFKD, or false
  caseSensitive: false,
  includeTranslations: true,   // translated labels may also match input
  boundaryMode: "auto",        // or "substring"
});
```

`boundaryMode: "auto"` applies a boundary only when the first or last character of a term is Latin or numeric. Japanese, Chinese, Korean, and Arabic terms remain eligible for mid-string matches.

### Matching rules

1. Input and glossary terms are normalized with Unicode NFKC and compared case-insensitively by default.
2. Aliases and translation labels are candidates by default. Duplicate normalized candidates within one entry are processed once.
3. CJK, Arabic, and other non-Latin terms are found as literal substrings; glossary content is never interpreted as a regular expression.
4. A Latin or numeric edge must not touch another Unicode Latin or numeric character in `auto` boundary mode.
5. A short occurrence fully contained by a longer occurrence is suppressed. The same short term at another position remains active.
6. Active occurrences from different entries with the same span are reported in `conflicts`; neither entry is chosen automatically.

All matching is literal and deterministic. `findOccurrences` expects text and terms that have already been normalized, which makes it useful when callers cache normalized glossary terms.

## Lint a glossary

```bash
glossary-match lint --glossary examples/glossary.json
```

Nested aliases are warnings, not errors. They may be intentional; the warning makes the runtime preference visible to glossary maintainers.

## Why not tokenize Japanese first?

Game names, product names, and other domain terms are often unknown to a general-purpose tokenizer. A tokenizer may split the exact phrase the glossary is supposed to preserve. This package therefore treats explicit aliases as authoritative and resolves overlapping occurrences deterministically.

Semantic paraphrases remain the translation model's responsibility. If the glossary contains `撃退`, it can match `撃退する`, but it will not infer that `追い払う` means something similar.

## What this package does not do

- It does not translate text or connect to OpenAI, DeepL, or another external service.
- It does not tokenize text, perform morphological analysis, or infer synonyms.
- It does not resolve semantic ambiguity or choose a winner when glossary entries conflict.
- It does not read YAML or CSV glossaries; the CLI accepts JSON.
- It does not send text or glossary data over the network and requires no API key.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run check
npm pack --dry-run
```

Node.js 20 or newer is supported. CI runs `npm ci` and `npm run check` on Node.js 20, 22, and 24.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Report suspected vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
