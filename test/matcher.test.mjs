import test from "node:test";
import assert from "node:assert/strict";
import {
  findOccurrences,
  formatPromptSection,
  matchGlossary,
  normalizeText,
} from "../dist/index.js";

const glossary = {
  entries: [
    {
      id: "dragon",
      aliases: ["黒龍", "Black Dragon"],
      translations: { en: "Black Dragon", ja: "黒龍" },
    },
    {
      id: "dragon-hunt",
      aliases: ["黒龍討伐戦", "Black Dragon Hunt"],
      translations: { en: "Black Dragon Hunt", ja: "黒龍討伐戦" },
      context: "An event name.",
    },
    { id: "fuel", aliases: ["Fuel"], translations: { en: "Fuel" } },
    {
      id: "refinery",
      aliases: ["Fuel Refinery"],
      translations: { en: "Fuel Refinery" },
    },
  ],
};

function matchIds(text, options) {
  return matchGlossary(text, glossary, options).matches.map(({ entry }) => entry.id);
}

test("prefers a longer CJK term and explains the suppressed occurrence", () => {
  const result = matchGlossary("黒龍討伐戦が始まる", glossary);

  assert.deepEqual(result.matches.map(({ entry }) => entry.id), ["dragon-hunt"]);
  assert.deepEqual(
    result.suppressed.map(({ term, start, end, reason, containedBy }) => ({
      term,
      start,
      end,
      reason,
      container: containedBy.term,
    })),
    [
      {
        term: "黒龍",
        start: 0,
        end: 2,
        reason: "contained-by-longer-term",
        container: "黒龍討伐戦",
      },
    ],
  );
});

test("keeps the same short term when it also appears at a separate position", () => {
  const result = matchGlossary("黒龍討伐戦の後、黒龍が現れた", glossary);

  assert.deepEqual(result.matches.map(({ entry }) => entry.id), ["dragon", "dragon-hunt"]);
  assert.deepEqual(result.matches[0].occurrences.map(({ start, end }) => [start, end]), [[8, 10]]);
  assert.equal(result.suppressed.length, 1);
  assert.deepEqual([result.suppressed[0].start, result.suppressed[0].end], [0, 2]);
});

test("matches Fuel as a standalone Latin term", () => {
  assert.deepEqual(matchIds("Fuel"), ["fuel"]);
});

test("does not match Fuel inside refuel", () => {
  assert.deepEqual(matchIds("We need to refuel"), []);
});

test("applies boundaries to TAC and Base", () => {
  const tac = { entries: [{ id: "tac", aliases: ["TAC"], translations: {} }] };
  assert.equal(matchGlossary("TAC", tac).matches.length, 1);
  assert.equal(matchGlossary("attack", tac).matches.length, 0);

  const base = { entries: [{ id: "base", aliases: ["Base"], translations: {} }] };
  assert.equal(matchGlossary("database", base).matches.length, 0);
});

test("suppresses Fuel inside Fuel Refinery but keeps a standalone Fuel", () => {
  const result = matchGlossary("Move Fuel to the Fuel Refinery", glossary);
  const fuel = result.matches.find(({ entry }) => entry.id === "fuel");

  assert.deepEqual(result.matches.map(({ entry }) => entry.id), ["fuel", "refinery"]);
  assert.deepEqual(fuel.occurrences.map(({ start, end }) => [start, end]), [[5, 9]]);
  assert.equal(result.suppressed.length, 1);
  assert.equal(result.suppressed[0].containedBy.term, "Fuel Refinery");
});

test("normalizes full-width Latin text and case with NFKC", () => {
  const result = matchGlossary("ＢＬＡＣＫ　ＤＲＡＧＯＮ", glossary);

  assert.equal(result.normalizedText, "black dragon");
  assert.deepEqual(result.matches.map(({ entry }) => entry.id), ["dragon"]);
});

test("supports normalization, case, translation, and boundary options", () => {
  const translated = {
    entries: [{ id: "dragon", aliases: ["黒龍"], translations: { en: "Black Dragon" } }],
  };

  assert.equal(matchGlossary("Black Dragon", translated).matches.length, 1);
  assert.equal(
    matchGlossary("Black Dragon", translated, { includeTranslations: false }).matches.length,
    0,
  );
  assert.equal(matchGlossary("fuel", glossary, { caseSensitive: true }).matches.length, 0);
  assert.equal(matchGlossary("refuel", glossary, { boundaryMode: "substring" }).matches.length, 1);
  assert.equal(normalizeText("Ｆ", { normalization: false }), "ｆ");
});

test("uses complete Unicode code points for numeric boundaries", () => {
  const term = normalizeText("𝟙", { normalization: false });

  assert.deepEqual(findOccurrences("𝟙", term, { normalization: false }), [[0, 2]]);
  assert.deepEqual(findOccurrences("𝟙𝟚", term, { normalization: false }), []);
});

test("reports active same-span conflicts without choosing an entry", () => {
  const result = matchGlossary("研究所", {
    entries: [
      { id: "a", aliases: ["研究所"], translations: { en: "Lab" } },
      { id: "b", aliases: ["研究所"], translations: { en: "Research Institute" } },
    ],
  });

  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].kind, "same-span");
  assert.deepEqual(result.conflicts[0].occurrences.map(({ entryId }) => entryId), ["a", "b"]);
  assert.deepEqual(result.matches.map(({ entry }) => entry.id), ["a", "b"]);
});

test("reports partly overlapping occurrences from different entries as an overlap conflict", () => {
  const result = matchGlossary("ABC", {
    entries: [
      { id: "ab", aliases: ["AB"], translations: {} },
      { id: "bc", aliases: ["BC"], translations: {} },
    ],
  }, { boundaryMode: "substring" });

  assert.deepEqual(result.conflicts.map(({ kind, start, end }) => ({ kind, start, end })), [
    { kind: "overlap", start: 0, end: 3 },
  ]);
  assert.deepEqual(result.conflicts[0].occurrences.map(({ entryId }) => entryId), ["ab", "bc"]);
  // Like same-span conflicts, both stay active; the caller decides.
  assert.deepEqual(result.matches.map(({ entry }) => entry.id), ["ab", "bc"]);
  assert.deepEqual(result.suppressed, []);
});

test("reports a Japanese partial overlap but not a term fully inside a longer one", () => {
  const entries = [
    { id: "dragon-hunt", aliases: ["黒龍討伐"], translations: {} },
    { id: "battle", aliases: ["討伐戦"], translations: {} },
  ];
  const overlap = matchGlossary("黒龍討伐戦に参加", entries);
  assert.equal(overlap.conflicts.length, 1);
  assert.equal(overlap.conflicts[0].kind, "overlap");
  assert.equal(overlap.normalizedText.slice(overlap.conflicts[0].start, overlap.conflicts[0].end), "黒龍討伐戦");

  // With the full event name as an alias, both shorter terms are contained and suppressed instead.
  const contained = matchGlossary("黒龍討伐戦に参加", [...entries, { id: "event", aliases: ["黒龍討伐戦"], translations: {} }]);
  assert.deepEqual(contained.conflicts, []);
  assert.deepEqual(contained.matches.map(({ entry }) => entry.id), ["event"]);
});

test("does not treat adjacent or same-entry overlaps as conflicts", () => {
  const adjacent = matchGlossary("ABCD", {
    entries: [
      { id: "ab", aliases: ["AB"], translations: {} },
      { id: "cd", aliases: ["CD"], translations: {} },
    ],
  }, { boundaryMode: "substring" });
  assert.deepEqual(adjacent.conflicts, []);

  const sameEntry = matchGlossary("ああああ", [{ id: "a", aliases: ["あああ"], translations: {} }]);
  assert.equal(sameEntry.matches[0].occurrences.length, 2);
  assert.deepEqual(sameEntry.conflicts, []);
});

test("formats only active terms with a translation for the requested locale", () => {
  const result = matchGlossary("黒龍討伐戦", glossary);

  assert.equal(
    formatPromptSection(result, "en"),
    "Terms:\n- 黒龍討伐戦 → Black Dragon Hunt\n  Context: An event name.\n",
  );
  assert.doesNotMatch(formatPromptSection(result, "en"), /^- 黒龍 →/m);
  assert.equal(formatPromptSection(result, "fr"), "");
});
