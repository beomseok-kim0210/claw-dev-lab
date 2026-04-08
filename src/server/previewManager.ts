import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, stat } from "node:fs/promises";
import path from "node:path";

type PreviewResult =
  | {
      ok: true;
      url: string;
      detail: string;
    }
  | {
      ok: false;
      detail: string;
    };

const PREVIEW_PORT = 4040;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const PREVIEW_LOG_FILENAME = "app-runtime.log";

let activePreviewProcess: ChildProcessWithoutNullStreams | undefined;
let activePreviewTarget: string | undefined;

export async function startWorkspacePreview(targetDirectory: string): Promise<PreviewResult> {
  const packageJsonPath = path.resolve(targetDirectory, "package.json");
  const serverPath = path.resolve(targetDirectory, "src", "server.ts");

  if (!(await fileExists(packageJsonPath)) || !(await fileExists(serverPath))) {
    return {
      ok: false,
      detail: "미리보기를 시작할 앱 서버 파일이 아직 생성되지 않았습니다.",
    };
  }

  if (activePreviewProcess && activePreviewTarget === targetDirectory) {
    const healthy = await waitForPreview(4_000);
    if (healthy) {
      return {
        ok: true,
        url: PREVIEW_URL,
        detail: "기존 미리보기 서버를 그대로 사용 중입니다.",
      };
    }
  }

  await stopActivePreview();
  const installResult = await ensureNodeModules(targetDirectory);
  if (!installResult.ok) {
    return installResult;
  }

  const tsxCommand = resolveTsxCommand(targetDirectory);
  let previewProcess: ChildProcessWithoutNullStreams;
  try {
    previewProcess = spawn(tsxCommand.command, tsxCommand.args, {
      cwd: targetDirectory,
      env: {
        ...process.env,
        PORT: String(PREVIEW_PORT),
      },
      stdio: "pipe",
    });
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const logPath = path.resolve(targetDirectory, PREVIEW_LOG_FILENAME);
  const writeLog = (chunk: Buffer) => appendLog(logPath, chunk.toString("utf8"));
  previewProcess.stdout.on("data", writeLog);
  previewProcess.stderr.on("data", writeLog);

  activePreviewProcess = previewProcess;
  activePreviewTarget = targetDirectory;

  const healthy = await waitForPreview(20_000);
  if (!healthy) {
    await stopActivePreview();
    return {
      ok: false,
      detail: "미리보기 서버를 시작했지만 웹 응답을 확인하지 못했습니다.",
    };
  }

  return {
    ok: true,
    url: PREVIEW_URL,
    detail: "생성된 앱 미리보기가 준비되었습니다.",
  };
}

function resolveTsxCommand(targetDirectory: string): { command: string; args: string[] } {
  return {
    command: process.execPath,
    args: [path.resolve(targetDirectory, "node_modules", "tsx", "dist", "cli.mjs"), "src/server.ts"],
  };
}

async function ensureNodeModules(targetDirectory: string): Promise<PreviewResult> {
  const nodeModulesPath = path.resolve(targetDirectory, "node_modules");
  if (await directoryExists(nodeModulesPath)) {
    return {
      ok: true,
      url: PREVIEW_URL,
      detail: "기존 의존성을 사용합니다.",
    };
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const installResult = await runCommand(npmCommand, ["install", "--include=dev"], targetDirectory, 120_000);
  if (!installResult.ok) {
    return {
      ok: false,
      detail: `미리보기 의존성 설치에 실패했습니다. ${installResult.detail}`,
    };
  }

  return {
    ok: true,
    url: PREVIEW_URL,
    detail: "미리보기 의존성 설치가 완료되었습니다.",
  };
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<PreviewResult> {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "pipe",
    });
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill();
      resolve(null);
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  if (exitCode !== 0) {
    return {
      ok: false,
      detail: output.trim().slice(-600) || "명령이 정상 종료되지 않았습니다.",
    };
  }

  return {
    ok: true,
    url: PREVIEW_URL,
    detail: "명령이 성공적으로 완료되었습니다.",
  };
}

async function waitForPreview(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${PREVIEW_URL}/api/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // keep polling
    }
    await sleep(700);
  }
  return false;
}

async function stopActivePreview(): Promise<void> {
  if (!activePreviewProcess) {
    return;
  }

  const processToStop = activePreviewProcess;
  activePreviewProcess = undefined;
  activePreviewTarget = undefined;

  processToStop.kill();
  await new Promise<void>((resolve) => {
    processToStop.once("close", () => resolve());
    setTimeout(() => resolve(), 2_000);
  });
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(targetPath: string): Promise<boolean> {
  try {
    const targetStat = await stat(targetPath);
    return targetStat.isDirectory();
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function appendLog(logPath: string, content: string): Promise<void> {
  try {
    const { appendFile, mkdir } = await import("node:fs/promises");
    await mkdir(path.dirname(logPath), { recursive: true });
    await appendFile(logPath, content, "utf8");
  } catch {
    // Ignore preview log write errors so the preview process can keep running.
  }
}
