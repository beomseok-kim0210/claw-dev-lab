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
}): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  checks.push(...(await runSyntaxChecks(args.projectRoot, args.generatedArtifacts)));
  checks.push(await runTypeCheck(args.projectRoot, args.toolingRoot));
  checks.push(await runNodeTests(args.projectRoot));

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

  try {
    await execFileAsync(process.execPath, [tscPath, "--noEmit", "-p", tsconfigPath], {
      cwd: projectRoot,
      timeout: 30_000,
    });
    return {
      name: "typescript check",
      command: "tsc --noEmit -p tsconfig.json",
      status: "passed",
      summary: "전체 워크스페이스 타입 검사를 통과했습니다.",
    };
  } catch (error) {
    return {
      name: "typescript check",
      command: "tsc --noEmit -p tsconfig.json",
      status: "failed",
      summary: "타입 검사에서 오류가 발생했습니다.",
      outputSnippet: formatExecError(error),
    };
  }
}

async function runNodeTests(projectRoot: string): Promise<VerificationCheck> {
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
    await execFileAsync(process.execPath, ["--test", ...selectedTests], {
      cwd: projectRoot,
      timeout: 30_000,
    });
    return {
      name: "node --test",
      command: `node --test ${selectedTests.join(" ")}`,
      status: "passed",
      summary: `${selectedTests.length}개 테스트 파일을 실행했고 모두 통과했습니다.`,
    };
  } catch (error) {
    return {
      name: "node --test",
      command: `node --test ${selectedTests.join(" ")}`,
      status: "failed",
      summary: "Node 테스트 실행 중 실패가 발생했습니다.",
      outputSnippet: formatExecError(error),
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
