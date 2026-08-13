import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

async function runCli(args) {
  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      encoding: "utf8",
    });
    return { ...result, exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: error.code,
    };
  }
}

test("CLI match, JSON output, and lint exit codes work end to end", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "glossary-match-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const validPath = join(directory, "valid.json");
  const invalidPath = join(directory, "invalid.json");
  await writeFile(
    validPath,
    JSON.stringify({
      entries: [
        { id: "dragon", aliases: ["黒龍"], translations: { en: "Black Dragon" } },
        {
          id: "hunt",
          aliases: ["黒龍討伐戦"],
          translations: { en: "Black Dragon Hunt" },
        },
      ],
    }),
  );
  await writeFile(
    invalidPath,
    JSON.stringify({ entries: [{ id: "", aliases: [], translations: {} }] }),
  );

  const match = await runCli([
    "match",
    "--glossary",
    validPath,
    "--text",
    "黒龍討伐戦",
    "--locale",
    "en",
  ]);
  assert.equal(match.exitCode, 0);
  assert.match(match.stdout, /Terms:\n- 黒龍討伐戦 → Black Dragon Hunt/);
  assert.match(match.stdout, /Suppressed: 黒龍 \(contained by 黒龍討伐戦\)/);

  const json = await runCli([
    "match",
    "--glossary",
    validPath,
    "--text",
    "黒龍討伐戦",
    "--json",
  ]);
  const parsed = JSON.parse(json.stdout);
  assert.equal(json.exitCode, 0);
  assert.equal(parsed.matches[0].entry.id, "hunt");
  assert.equal(parsed.suppressed[0].reason, "contained-by-longer-term");
  assert.deepEqual(parsed.conflicts, []);

  const warningOnly = await runCli(["lint", "--glossary", validPath]);
  assert.equal(warningOnly.exitCode, 0);
  assert.match(warningOnly.stdout, /WARNING nested-alias/);

  const lintError = await runCli(["lint", "--glossary", invalidPath, "--json"]);
  assert.equal(lintError.exitCode, 1);
  assert.ok(JSON.parse(lintError.stdout).some(({ severity }) => severity === "error"));

  const usageError = await runCli(["match", "--glossary", validPath]);
  assert.equal(usageError.exitCode, 2);
  assert.match(usageError.stderr, /--text is required/);

  const unknownArgument = await runCli([
    "match",
    "--glossary",
    validPath,
    "--text",
    "黒龍",
    "--unknown",
  ]);
  assert.equal(unknownArgument.exitCode, 2);
  assert.match(unknownArgument.stderr, /Unknown argument: --unknown/);
});
