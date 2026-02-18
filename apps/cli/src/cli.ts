#!/usr/bin/env node

interface ParsedArgs {
  command?: string;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (!args.command) {
      args.command = token;
    }
  }

  return args;
}

function getUsage(): string {
  return [
    "Usage:",
    "  kwielford help",
    "",
    "Current focus:",
    "  - Chat with Kwielford about improving Kwielford",
    "  - Plan incremental cross-channel access for Kwielford"
  ].join("\n");
}

export async function runCli(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.help || !parsed.command || parsed.command === "help") {
    console.log(getUsage());
    return 0;
  }

  console.error(`Unknown command: ${parsed.command}`);
  console.log(getUsage());
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown CLI error";
      console.error(message);
      process.exitCode = 1;
    });
}
