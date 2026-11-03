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

Use --text=<text> when the text itself starts with "--".

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

interface ParsedArgs {
  values: Map<string, string>;
  json: boolean;
  help: boolean;
}

/**
 * Reads options by position, so a value such as `--text -h` is text, not a request for help.
 * `--flag=value` lets a value start with `--`; a separate value starting with `--` is rejected
 * because it is more likely a forgotten value than text.
 */
function parseArgs(args: string[], command: Command): ParsedArgs {
  const valueFlags = new Set(
    command === "match" ? ["--glossary", "--text", "--locale"] : ["--glossary"],
  );
  const values = new Map<string, string>();
  let json = false;
  let help = false;

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--json") {
      if (json) throw new Error(`${argument} may only be specified once.`);
      json = true;
      continue;
    }

    const equals = argument.indexOf("=");
    const flag = argument.startsWith("--") && equals > 0 ? argument.slice(0, equals) : argument;
    if (!valueFlags.has(flag)) throw new Error(`Unknown argument: ${flag}`);
    if (values.has(flag)) throw new Error(`${flag} may only be specified once.`);

    if (flag !== argument) {
      values.set(flag, argument.slice(equals + 1));
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${flag} requires a value.`);
    }
    values.set(flag, value);
    index += 1;
  }

  return { values, json, help };
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

  if (command !== "match" && command !== "lint") {
    throw new Error(`Unknown command: ${command}`);
  }
  const { values, json, help } = parseArgs(args, command);
  if (help) {
    process.stdout.write(HELP);
    return;
  }

  const glossaryPath = values.get("--glossary");
  if (!glossaryPath) throw new Error("--glossary is required.");
  const glossary = await loadGlossary(glossaryPath);

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
    const text = values.get("--text");
    if (text === undefined) throw new Error("--text is required.");
    const result = matchGlossary(text, glossary);
    if (json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const locale = values.get("--locale") ?? "en";
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
