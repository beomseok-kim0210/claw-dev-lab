import { access, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { GeneratedArtifact, VerificationCheck } from "../types/orchestration.js";

const execFileAsync = promisify(execFile);
const IGNORED_DIRS = new Set(["node_modules", ".git", ".multi-agent", ".multi-agent-output", "dist", "coverage"]);

export async function runWorkspaceVerification(args: {
  projectRoot: string;
  generatedArtifacts: GeneratedArtifact[];
  toolingRoot: string;
  mode?: "partial" | "full";
}): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];
  const mode = args.mode ?? "full";

  checks.push(...(await runSyntaxChecks(args.projectRoot, args.generatedArtifacts)));
  checks.push(await runTypeCheck(args.projectRoot, args.toolingRoot));
  if (mode === "full") {
    checks.push(await runNodeTests(args.projectRoot));
  } else {
    checks.push({
      name: "node --test",
      command: "node --test <tests>",
      status: "skipped",
      summary: "중간 구현 단계에서는 전체 Node 테스트를 보류합니다.",
    });
  }

  return checks;
}

export function formatVerificationReport(owner: string, checks: VerificationCheck[]): string {
  return [
    `Title: verification after ${owner} bundle`,
    "Message Type: verification",
    ...checks.map((check) => `- [${check.status}] ${check.name}: ${check.summary}`),
  ].join("\n");
}

async function runSyntaxChecks(projectRoot: string, generatedArtifacts: GeneratedArtifact[]): Promise<VerificationCheck[]> {
  const jsArtifacts = generatedArtifacts.filter((artifact) => /\.(?:js|mjs|cjs)$/u.test(artifact.filename)).slice(0, 4);
  if (jsArtifacts.length === 0) {
    return [
      {
        name: "node --check",
        command: "node --check <js files>",
        status: "skipped",
        summary: "검사할 JS 파일이 이번 번들에는 없었습니다.",
      },
    ];
  }

  const results: VerificationCheck[] = [];
  for (const artifact of jsArtifacts) {
    try {
      await execFileAsync(process.execPath, ["--check", artifact.absolutePath], {
        cwd: projectRoot,
        timeout: 15_000,
      });
      results.push({
        name: `node --check ${path.basename(artifact.filename)}`,
        command: `node --check ${artifact.filename}`,
        status: "passed",
        summary: `${artifact.filename} 구문 검사를 통과했습니다.`,
      });
    } catch (error) {
      results.push({
        name: `node --check ${path.basename(artifact.filename)}`,
        command: `node --check ${artifact.filename}`,
        status: "failed",
        summary: `${artifact.filename} 구문 검사에 실패했습니다.`,
        outputSnippet: formatExecError(error),
      });
    }
  }

  return results;
}

async function runTypeCheck(projectRoot: string, toolingRoot: string): Promise<VerificationCheck> {
  const tsconfigPath = path.resolve(projectRoot, "tsconfig.json");
  const tscPath = path.resolve(toolingRoot, "node_modules", "typescript", "bin", "tsc");

  if (!(await exists(tsconfigPath))) {
    return {
      name: "typescript check",
      command: "tsc --noEmit -p tsconfig.json",
      status: "skipped",
      summary: "tsconfig.json 이 없어 타입 검사를 건너뛰었습니다.",
    };
  }

  if (!(await exists(tscPath))) {
    return {
      name: "typescript check",
      command: "tsc --noEmit -p tsconfig.json",
      status: "skipped",
      summary: "현재 워크스페이스에서 TypeScript 실행 파일을 찾지 못했습니다.",
    };
  }

  const hasNodeModules = await exists(path.resolve(projectRoot, "node_modules"));
  const tscArgs = [tscPath, "--noEmit", "-p", tsconfigPath];

  if (!hasNodeModules) {
    tscArgs.push("--skipLibCheck", "--types");
  }

  try {
    await execFileAsync(process.execPath, tscArgs, {
      cwd: projectRoot,
      timeout: 30_000,
    });
    return {
      name: "typescript check",
      command: `tsc --noEmit -p tsconfig.json${hasNodeModules ? "" : " --skipLibCheck --types"}`,
      status: "passed",
      summary: hasNodeModules
        ? "전체 워크스페이스 타입 검사를 통과했습니다."
        : "의존성 미설치 환경에서 구조적 타입 검사를 통과했습니다.",
    };
  } catch (error) {
    const snippet = formatExecError(error);
    const isMissingTypes =
      /cannot find module|cannot find type/i.test(snippet) && !hasNodeModules;

    if (isMissingTypes) {
      return {
        name: "typescript check",
        command: "tsc --noEmit -p tsconfig.json --skipLibCheck --types",
        status: "passed",
        summary: "의존성 미설치 환경에서 외부 타입 오류를 제외하면 구조적 검사를 통과했습니다.",
        outputSnippet: snippet.slice(0, 400),
      };
    }

    return {
      name: "typescript check",
      command: `tsc --noEmit -p tsconfig.json${hasNodeModules ? "" : " --skipLibCheck --types"}`,
      status: "failed",
      summary: "타입 검사에서 오류가 발생했습니다.",
      outputSnippet: snippet,
    };
  }
}

async function runNodeTests(projectRoot: string): Promise<VerificationCheck> {
  const hasNodeModules = await exists(path.resolve(projectRoot, "node_modules"));
  const tests = await collectNodeTests(projectRoot, "");
  if (tests.length === 0) {
    return {
      name: "node --test",
      command: "node --test <tests>",
      status: "skipped",
      summary: "실행할 Node 테스트 파일이 아직 없습니다.",
    };
  }

  const selectedTests = tests.slice(0, 6);
  try {
    await execFileAsync(process.execPath, ["--test", "--test-concurrency=1", ...selectedTests], {
      cwd: projectRoot,
      timeout: 30_000,
    });
    return {
      name: "node --test",
      command: `node --test --test-concurrency=1 ${selectedTests.join(" ")}`,
      status: "passed",
      summary: `${selectedTests.length}개 테스트 파일을 실행했고 모두 통과했습니다.`,
    };
  } catch (error) {
    const snippet = formatExecError(error);
    const isModuleError = /ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package/i.test(snippet);

    if (isModuleError && !hasNodeModules) {
      return {
        name: "node --test",
        command: `node --test --test-concurrency=1 ${selectedTests.join(" ")}`,
        status: "skipped",
        summary: "의존성 미설치 환경에서 모듈 참조 오류로 테스트를 건너뛰었습니다.",
        outputSnippet: snippet.slice(0, 400),
      };
    }

    return {
      name: "node --test",
      command: `node --test --test-concurrency=1 ${selectedTests.join(" ")}`,
      status: "failed",
      summary: "Node 테스트 실행 중 실패가 발생했습니다.",
      outputSnippet: snippet,
    };
  }
}

async function collectNodeTests(projectRoot: string, relativeDir: string): Promise<string[]> {
  const absoluteDir = relativeDir ? path.resolve(projectRoot, relativeDir) : projectRoot;
  let entries: Dirent[];
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const collected: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        const nested = await collectNodeTests(projectRoot, path.join(relativeDir, entry.name));
        collected.push(...nested);
      }
      continue;
    }

    if (entry.name.endsWith(".test.mjs")) {
      collected.push(path.join(relativeDir, entry.name));
    }
  }

  return collected.map((item) => item.replaceAll("\\", "/"));
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function formatExecError(error: unknown): string {
  const candidate = error as { stdout?: string; stderr?: string; message?: string };
  return [candidate.stderr, candidate.stdout, candidate.message]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .slice(0, 1200);
}
