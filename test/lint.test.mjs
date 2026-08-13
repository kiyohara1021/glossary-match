import test from "node:test";
import assert from "node:assert/strict";
import { lintGlossary } from "../dist/index.js";

test("warns when aliases are shared by different entries", () => {
  const issues = lintGlossary({
    entries: [
      { id: "a", aliases: ["研究所"], translations: {} },
      { id: "b", aliases: ["研究所"], translations: {} },
    ],
  });

  assert.ok(issues.some(({ severity, code }) => severity === "warning" && code === "duplicate-alias"));
  assert.ok(issues.every(({ severity }) => severity !== "error"));
});

test("warns when an alias is contained in another entry's longer alias", () => {
  const issues = lintGlossary({
    entries: [
      { id: "dragon", aliases: ["黒龍"], translations: {} },
      { id: "hunt", aliases: ["黒龍討伐戦"], translations: {} },
    ],
  });

  const nested = issues.find(({ code }) => code === "nested-alias");
  assert.equal(nested?.severity, "warning");
  assert.deepEqual(nested?.entryIds, ["dragon", "hunt"]);
});

test("reports empty IDs, duplicate IDs, missing aliases, and blank aliases as errors", () => {
  const issues = lintGlossary({
    entries: [
      { id: "", aliases: ["valid"], translations: {} },
      { id: "duplicate", aliases: [], translations: {} },
      { id: "duplicate", aliases: ["　"], translations: {} },
    ],
  });
  const errorCodes = new Set(
    issues.filter(({ severity }) => severity === "error").map(({ code }) => code),
  );

  assert.deepEqual(errorCodes, new Set([
    "empty-entry-id",
    "duplicate-entry-id",
    "missing-alias",
    "empty-alias",
  ]));
});
