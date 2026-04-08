import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import pc from "picocolors";

import { DEFAULT_EXAMPLE_REQUEST, loadAppConfig, resolveDefaultTargetDirectory } from "./config.js";
import { OllamaClient } from "./llm/ollamaClient.js";
import { printExecutionReport } from "./orchestrator/consoleReporter.js";
import { MultiAgentOrchestrator } from "./orchestrator/multiAgentOrchestrator.js";

type ParsedArgs = {
  cwd: string;
  outputDir?: string;
  targetDir?: string;
  model?: string;
  baseUrl?: string;
  request?: string;
  showHelp: boolean;
  useExample: boolean;
};

type NpmConfigArgs = {
  cwd?: string;
  outputDir?: string;
  targetDir?: string;
  model?: string;
  baseUrl?: string;
};

function printHelp(): void {
  process.stdout.write("Multi-Agent Collaboration System\n\n");
  process.stdout.write("Usage:\n");
  process.stdout.write('  npm run dev -- "build an AI support dashboard"\n');
  process.stdout.write("  npm run dev -- --example\n");
  process.stdout.write(
    `  npm run dev -- --cwd E:\\repo --output-dir .\\artifacts --target-dir ${resolveDefaultTargetDirectory()} --model qwen3.5 "design a PRD workspace"\n\n`,
  );
  process.stdout.write("Flags:\n");
  process.stdout.write("  --help         Show this help text\n");
  process.stdout.write("  --example      Run the built-in example request\n");
  process.stdout.write("  --cwd          Set the working directory\n");
  process.stdout.write("  --output-dir   Directory for markdown artifacts\n");
  process.stdout.write("  --target-dir   Directory where generated code files are written\n");
  process.stdout.write("  --model        Override the Ollama model\n");
  process.stdout.write("  --base-url     Override the Ollama base URL\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  let cwd = process.cwd();
  let outputDir: string | undefined;
  let targetDir: string | undefined;
  let model: string | undefined;
  let baseUrl: string | undefined;
  let showHelp = false;
  let useExample = false;
  const requestParts: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg || arg === "--") {
      continue;
    }

    const inline = splitInlineFlag(arg);
    if (inline) {
      const consumed = applyFlagValue(inline.flag, inline.value);
      if (consumed) {
        continue;
      }
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
      case "--target-dir":
        targetDir = path.resolve(argv[i + 1] ?? cwd);
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

  const npmConfig = readNpmConfigArgs();
  const consumedFromNpm: string[] = [];

  if (cwd === process.cwd() && npmConfig.cwd) {
    cwd = path.resolve(npmConfig.cwd);
    consumedFromNpm.push(npmConfig.cwd);
  }
  if (outputDir === undefined && npmConfig.outputDir) {
    outputDir = path.resolve(cwd, npmConfig.outputDir);
    consumedFromNpm.push(npmConfig.outputDir);
  }
  if (targetDir === undefined && npmConfig.targetDir) {
    targetDir = path.resolve(cwd, npmConfig.targetDir);
    consumedFromNpm.push(npmConfig.targetDir);
  }
  if (model === undefined && npmConfig.model) {
    model = npmConfig.model;
    consumedFromNpm.push(npmConfig.model);
  }
  if (baseUrl === undefined && npmConfig.baseUrl) {
    baseUrl = npmConfig.baseUrl;
    consumedFromNpm.push(npmConfig.baseUrl);
  }

  const cleanedRequestParts = stripLeadingMirroredValues(requestParts, consumedFromNpm);

  const parsed: ParsedArgs = {
    cwd,
    showHelp,
    useExample,
  };

  if (outputDir !== undefined) {
    parsed.outputDir = outputDir;
  }
  if (targetDir !== undefined) {
    parsed.targetDir = targetDir;
  }
  if (model !== undefined) {
    parsed.model = model;
  }
  if (baseUrl !== undefined) {
    parsed.baseUrl = baseUrl;
  }
  if (cleanedRequestParts.length > 0) {
    parsed.request = cleanedRequestParts.join(" ");
  }

  return parsed;

  function applyFlagValue(flag: string, value: string): boolean {
    switch (flag) {
      case "--cwd":
        cwd = path.resolve(value);
        return true;
      case "--output-dir":
        outputDir = path.resolve(cwd, value);
        return true;
      case "--target-dir":
        targetDir = path.resolve(cwd, value);
        return true;
      case "--model":
        model = value;
        return true;
      case "--base-url":
        baseUrl = value;
        return true;
      default:
        return false;
    }
  }
}

function splitInlineFlag(arg: string): { flag: string; value: string } | undefined {
  const separatorIndex = arg.indexOf("=");
  if (!arg.startsWith("--") || separatorIndex < 0) {
    return undefined;
  }

  return {
    flag: arg.slice(0, separatorIndex),
    value: arg.slice(separatorIndex + 1),
  };
}

function readNpmConfigArgs(): NpmConfigArgs {
  const parsed: NpmConfigArgs = {};
  const cwd = readNpmConfigValue("cwd");
  const outputDir = readNpmConfigValue("output_dir");
  const targetDir = readNpmConfigValue("target_dir");
  const model = readNpmConfigValue("model");
  const baseUrl = readNpmConfigValue("base_url");

  if (cwd !== undefined) {
    parsed.cwd = cwd;
  }
  if (outputDir !== undefined) {
    parsed.outputDir = outputDir;
  }
  if (targetDir !== undefined) {
    parsed.targetDir = targetDir;
  }
  if (model !== undefined) {
    parsed.model = model;
  }
  if (baseUrl !== undefined) {
    parsed.baseUrl = baseUrl;
  }

  return parsed;
}

function readNpmConfigValue(key: string): string | undefined {
  const value = process.env[`npm_config_${key}`];
  if (!value || value === "true" || value === "false") {
    return undefined;
  }
  return value;
}

function stripLeadingMirroredValues(requestParts: string[], mirroredValues: string[]): string[] {
  const queue = [...requestParts];
  const remainingValues = mirroredValues.filter((value) => value.trim().length > 0);

  while (queue.length > 0) {
    const head = queue[0];
    if (!head) {
      queue.shift();
      continue;
    }

    const matchedIndex = remainingValues.findIndex((value) => sameArgumentValue(head, value));
    if (matchedIndex < 0) {
      break;
    }

    queue.shift();
    remainingValues.splice(matchedIndex, 1);
  }

  return queue;
}

function sameArgumentValue(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }

  if (isProbablyPathLike(left) || isProbablyPathLike(right)) {
    return path.resolve(left) === path.resolve(right);
  }

  return false;
}

function isProbablyPathLike(value: string): boolean {
  return /[\\/]/u.test(value) || /^[A-Za-z]:/u.test(value) || value.startsWith(".");
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
  const codegenClient =
    config.ollamaCodegenModel !== config.ollamaModel
      ? new OllamaClient({
          baseUrl: config.ollamaBaseUrl,
          model: config.ollamaCodegenModel,
          timeoutMs: config.timeoutMs,
        })
      : client;

  const pipedAnswers = input.isTTY ? [] : await readPipedAnswers();
  const rl = input.isTTY ? readline.createInterface({ input, output }) : undefined;

  try {
    const orchestrator = new MultiAgentOrchestrator({
      client,
      codegenClient,
      outputDir: config.outputDir,
      ...(parsed.targetDir
        ? {
            codeOutputDir: parsed.targetDir,
            codePathPrefix: "",
          }
        : {}),
      hooks: {
        onCodeActivity(update) {
          if (update.currentFile) {
            process.stdout.write(
              `[file-write] ${update.owner} ${update.state === "completed" ? "completed" : "writing"} -> ${update.currentFile}\n`,
            );
          }
        },
        async onClarificationRequest(plan) {
          process.stdout.write(`\n[clarification] ${plan.summary}\n`);
          const answers = [];

          for (const question of plan.questions) {
            process.stdout.write(`- ${question.id} | ${question.askedBy} | ${question.topic}\n  reason: ${question.reason}\n`);

            let answer = "";
            if (pipedAnswers.length > 0) {
              answer = pipedAnswers.shift() ?? "";
              process.stdout.write(`  answer: ${answer}\n`);
            } else if (rl) {
              answer = (await rl.question("  answer: ")).trim();
            }

            answers.push({
              questionId: question.id,
              answer: answer.length > 0 ? answer : "Proceed with a reasonable default assumption.",
            });
          }

          process.stdout.write("\n");
          return answers;
        },
      },
    });

    process.stdout.write(`Model: ${config.ollamaModel} (${config.ollamaBaseUrl})\n`);
    if (config.ollamaCodegenModel !== config.ollamaModel) {
      process.stdout.write(`Codegen Model: ${config.ollamaCodegenModel}\n`);
    }
    process.stdout.write(`Artifact directory: ${config.outputDir}\n`);
    if (parsed.targetDir) {
      process.stdout.write(`Code target directory: ${parsed.targetDir}\n`);
    }

    const result = await orchestrator.run(request);
    printExecutionReport(result);
  } finally {
    rl?.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${pc.red(`Error: ${message}`)}\n`);
  process.exitCode = 1;
});

async function readPipedAnswers(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
