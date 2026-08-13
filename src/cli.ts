#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { lintGlossary } from "./lint.js";
import { matchGlossary } from "./matcher.js";
import { formatPromptSection } from "./prompt.js";
import type { Glossary } from "./types.js";

const HELP = `glossary-match

Usage:
  glossary-match match --glossary <file> --text <text> [--locale <locale>] [--json]
  glossary-match lint  --glossary <file> [--json]

Examples:
  glossary-match match --glossary examples/glossary.json --text "黒龍討伐戦" --locale en
  glossary-match lint --glossary examples/glossary.json
`;

type Command = "match" | "lint";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGlossary(value: unknown): value is Glossary {
  if (!isRecord(value) || !Array.isArray(value.entries)) return false;

  return value.entries.every((entry) => {
    if (!isRecord(entry)) return false;
    if (typeof entry.id !== "string" || !Array.isArray(entry.aliases)) return false;
    if (!entry.aliases.every((alias) => typeof alias === "string")) return false;
    if (!isRecord(entry.translations)) return false;
    if (!Object.values(entry.translations).every((translation) => typeof translation === "string")) {
      return false;
    }
    return entry.context === undefined || typeof entry.context === "string";
  });
}

function validateArgs(args: string[], command: Command): void {
  const valueFlags = new Set(
    command === "match" ? ["--glossary", "--text", "--locale"] : ["--glossary"],
  );
  const seen = new Set<string>();

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--json") {
      if (seen.has(argument)) throw new Error(`${argument} may only be specified once.`);
      seen.add(argument);
      continue;
    }
    if (!valueFlags.has(argument)) throw new Error(`Unknown argument: ${argument}`);
    if (seen.has(argument)) throw new Error(`${argument} may only be specified once.`);

    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    seen.add(argument);
    index += 1;
  }
}

function valueOf(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

async function loadGlossary(path: string): Promise<Glossary> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isGlossary(parsed)) {
    throw new Error(
      "Glossary JSON must contain valid entries with string ids, aliases, and translations.",
    );
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  if (command !== "match" && command !== "lint") {
    throw new Error(`Unknown command: ${command}`);
  }
  validateArgs(args, command);

  const glossaryPath = valueOf(args, "--glossary");
  if (!glossaryPath) throw new Error("--glossary is required.");
  const glossary = await loadGlossary(glossaryPath);
  const json = args.includes("--json");

  if (command === "lint") {
    const issues = lintGlossary(glossary);
    if (json) {
      process.stdout.write(`${JSON.stringify(issues, null, 2)}\n`);
    } else if (issues.length === 0) {
      process.stdout.write("Glossary is valid.\n");
    } else {
      for (const issue of issues) {
        process.stdout.write(`${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}\n`);
      }
    }
    if (issues.some(({ severity }) => severity === "error")) process.exitCode = 1;
    return;
  }

  if (command === "match") {
    const text = valueOf(args, "--text");
    if (text === undefined) throw new Error("--text is required.");
    const result = matchGlossary(text, glossary);
    if (json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const locale = valueOf(args, "--locale") ?? "en";
      const prompt = formatPromptSection(result, locale);
      process.stdout.write(
        prompt ||
          (result.matches.length === 0
            ? "No glossary terms matched.\n"
            : `No matched terms have a translation for locale "${locale}".\n`),
      );
      for (const item of result.suppressed) {
        process.stdout.write(
          `Suppressed: ${item.term} (contained by ${item.containedBy.term})\n`,
        );
      }
      for (const conflict of result.conflicts) {
        const entryIds = [...new Set(conflict.occurrences.map(({ entryId }) => entryId))];
        process.stdout.write(
          `Conflict: [${conflict.start}, ${conflict.end}) matches ${entryIds.join(", ")}\n`,
        );
      }
    }
    return;
  }

}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n\n${HELP}`);
  process.exitCode = 2;
});
