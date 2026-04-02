import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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
  process.stdout.write("멀티 에이전트 협업 시스템\n\n");
  process.stdout.write("사용법:\n");
  process.stdout.write('  npm run dev -- "AI 고객지원 대시보드를 설계해줘"\n');
  process.stdout.write("  npm run dev -- --example\n");
  process.stdout.write(
    '  npm run dev -- --cwd E:\\repo --output-dir .\\artifacts --model qwen3 "PRD 워크스페이스를 설계해줘"\n\n',
  );
  process.stdout.write("옵션:\n");
  process.stdout.write("  --help         도움말 출력\n");
  process.stdout.write("  --example      내장 예시 요청 실행\n");
  process.stdout.write("  --cwd          작업 디렉터리 지정\n");
  process.stdout.write("  --output-dir   결과 문서와 생성 코드 출력 경로\n");
  process.stdout.write("  --model        Ollama 모델 이름 덮어쓰기\n");
  process.stdout.write("  --base-url     Ollama 기본 URL 덮어쓰기\n");
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

  const pipedAnswers = input.isTTY ? [] : await readPipedAnswers();
  const rl = input.isTTY ? readline.createInterface({ input, output }) : undefined;
  try {
    const orchestrator = new MultiAgentOrchestrator({
      client,
      outputDir: config.outputDir,
      hooks: {
        async onClarificationRequest(plan) {
          process.stdout.write(`\n[추가 확인] ${plan.summary}\n`);
          const answers = [];
          for (const question of plan.questions) {
            process.stdout.write(
              `- ${question.id} | ${question.askedBy} | ${question.topic}\n  이유: ${question.reason}\n`,
            );
            let answer = "";
            if (pipedAnswers.length > 0) {
              answer = pipedAnswers.shift() ?? "";
              process.stdout.write(`  답변: ${answer}\n`);
            } else if (rl) {
              answer = (await rl.question(`  답변: `)).trim();
            }
            answers.push({
              questionId: question.id,
              answer: answer.length > 0 ? answer : "추가 정보 없이 기본 가정으로 진행합니다.",
            });
          }
          process.stdout.write("\n");
          return answers;
        },
      },
    });

    process.stdout.write(`사용 모델: ${config.ollamaModel} (${config.ollamaBaseUrl})\n`);
    process.stdout.write(`출력 디렉터리: ${config.outputDir}\n`);

    const result = await orchestrator.run(request);
    printExecutionReport(result);
  } finally {
    rl?.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${pc.red(`오류: ${message}`)}\n`);
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
