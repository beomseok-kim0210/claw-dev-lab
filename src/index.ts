import path from "node:path";

import pc from "picocolors";

import { DEFAULT_EXAMPLE_REQUEST, loadAppConfig } from "./config.js";
import { OllamaClient } from "./llm/ollamaClient.js";
import { printExecutionReport } from "./orchestrator/consoleReporter.js";
import { MultiAgentOrchestrator } from "./orchestrator/multiAgentOrchestrator.js";

type ParsedArgs = {
  cwd: string;
  outputDir?: string;
  model?: string;
  baseUrl?: string;
  request?: string;
  showHelp: boolean;
  useExample: boolean;
};

function printHelp(): void {
  process.stdout.write("Multi-Agent Collaboration System\n\n");
  process.stdout.write("Usage:\n");
  process.stdout.write('  npm run dev -- "build an AI support dashboard"\n');
  process.stdout.write("  npm run dev -- --example\n");
  process.stdout.write(
    '  npm run dev -- --cwd E:\\repo --output-dir .\\artifacts --model qwen3 "design a PRD workspace"\n\n',
  );
  process.stdout.write("Flags:\n");
  process.stdout.write("  --help         Show this help text\n");
  process.stdout.write("  --example      Run the built-in example request\n");
  process.stdout.write("  --cwd          Set the working directory\n");
  process.stdout.write("  --output-dir   Directory for backend-spec.md, frontend-spec.md, ai-features.md\n");
  process.stdout.write("  --model        Override the Ollama model\n");
  process.stdout.write("  --base-url     Override the Ollama base URL\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  let cwd = process.cwd();
  let outputDir: string | undefined;
  let model: string | undefined;
  let baseUrl: string | undefined;
  let showHelp = false;
  let useExample = false;
  const requestParts: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) {
      continue;
    }

    switch (arg) {
      case "--help":
        showHelp = true;
        break;
      case "--example":
        useExample = true;
        break;
      case "--cwd":
        cwd = path.resolve(argv[i + 1] ?? cwd);
        i += 1;
        break;
      case "--output-dir":
        outputDir = path.resolve(argv[i + 1] ?? cwd);
        i += 1;
        break;
      case "--model":
        model = argv[i + 1];
        i += 1;
        break;
      case "--base-url":
        baseUrl = argv[i + 1];
        i += 1;
        break;
      default:
        requestParts.push(arg);
        break;
    }
  }

  const parsed: ParsedArgs = {
    cwd,
    showHelp,
    useExample,
  };

  if (outputDir !== undefined) {
    parsed.outputDir = outputDir;
  }
  if (model !== undefined) {
    parsed.model = model;
  }
  if (baseUrl !== undefined) {
    parsed.baseUrl = baseUrl;
  }
  if (requestParts.length > 0) {
    parsed.request = requestParts.join(" ");
  }

  return parsed;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.showHelp) {
    printHelp();
    return;
  }

  const request = parsed.useExample ? DEFAULT_EXAMPLE_REQUEST : parsed.request;
  if (!request) {
    printHelp();
    return;
  }

  const config = loadAppConfig({
    cwd: parsed.cwd,
    ...(parsed.outputDir !== undefined ? { outputDir: parsed.outputDir } : {}),
    ...(parsed.baseUrl !== undefined ? { ollamaBaseUrl: parsed.baseUrl } : {}),
    ...(parsed.model !== undefined ? { ollamaModel: parsed.model } : {}),
  });

  const client = new OllamaClient({
    baseUrl: config.ollamaBaseUrl,
    model: config.ollamaModel,
    timeoutMs: config.timeoutMs,
  });

  const orchestrator = new MultiAgentOrchestrator({
    client,
    outputDir: config.outputDir,
  });

  process.stdout.write(`Using Ollama model ${config.ollamaModel} at ${config.ollamaBaseUrl}\n`);
  process.stdout.write(`Output directory: ${config.outputDir}\n`);

  const result = await orchestrator.run(request);
  printExecutionReport(result);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${pc.red(`Error: ${message}`)}\n`);
  process.exitCode = 1;
});
