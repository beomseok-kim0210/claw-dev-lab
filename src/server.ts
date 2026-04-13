import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { URL } from "node:url";

import { z } from "zod";

import { loadServerConfig, resolveDefaultTargetDirectory } from "./config.js";
import { GeminiClient } from "./llm/geminiClient.js";
import { FallbackLLMClient } from "./llm/llmClient.js";
import { OllamaClient } from "./llm/ollamaClient.js";
import { MultiAgentOrchestrator } from "./orchestrator/multiAgentOrchestrator.js";
import { listWorkspaceFiles, loadProjectMemory } from "./orchestrator/projectMemory.js";
import { startWorkspacePreview } from "./server/previewManager.js";
import { SessionStore } from "./server/sessionStore.js";
import type { ClarificationAnswer } from "./types/orchestration.js";
import type { ProjectStartMode } from "./types/orchestration.js";

const createSessionSchema = z.object({
  request: z.string().trim().min(10).max(4000),
  targetDirectory: z.string().trim().min(1).max(500).optional(),
  startMode: z.enum(["new", "continue"]).optional(),
});

const clarificationAnswerSchema = z.object({
  questionId: z.string().regex(/^clarify-\d{2}$/),
  answer: z.string().trim().min(1).max(4000),
});

const submitClarificationSchema = z.object({
  answers: z.array(clarificationAnswerSchema).min(1).max(3),
});

const config = loadServerConfig();
const sessionStore = new SessionStore();

// Ollama 로컬 클라이언트 (항상 생성 — 폴백용)
const ollamaClient = new OllamaClient({
  baseUrl: config.ollamaBaseUrl,
  model: config.ollamaModel,
  timeoutMs: config.timeoutMs,
});

// Gemini API가 설정되어 있으면 Gemini 우선, 쿼터 소진 시 Ollama 폴백
const client = config.geminiApiKey
  ? new FallbackLLMClient(
      new GeminiClient({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        timeoutMs: config.timeoutMs,
      }),
      ollamaClient,
      (reason) => process.stdout.write(`[LLM fallback] ${reason}\n`),
    )
  : ollamaClient;

// 코드 생성 전용 클라이언트
// OLLAMA_CODEGEN_MODEL 미설정 시 → reasoning 모델과 동일 (기존 동작 유지)
// OLLAMA_CODEGEN_MODEL=qwen2.5-coder:7b 설정 시 → 코드 특화 모델로 분리
const codegenClient = config.ollamaCodegenModel !== config.ollamaModel
  ? new OllamaClient({
      baseUrl: config.ollamaBaseUrl,
      model: config.ollamaCodegenModel,
      timeoutMs: config.timeoutMs,
    })
  : client;

const publicRoot = path.resolve(config.cwd, "public");

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? "GET";
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

    if (method === "GET" && requestUrl.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        model: config.ollamaModel,
        codegenModel: config.ollamaCodegenModel,
        baseUrl: config.ollamaBaseUrl,
        defaultTargetDirectory: resolveDefaultTargetDirectory(),
      });
    }

    if (method === "GET" && requestUrl.pathname === "/api/project-memory") {
      const targetDirectory = normalizeTargetDirectory(requestUrl.searchParams.get("targetDirectory") ?? undefined);
      const preview = await inspectProjectTarget(targetDirectory);
      return sendJson(res, 200, preview);
    }

    if (method === "GET" && requestUrl.pathname === "/api/sessions") {
      const sessions = await sessionStore.listSessions();
      return sendJson(res, 200, sessions);
    }

    if (method === "POST" && requestUrl.pathname === "/api/sessions") {
      const payload = createSessionSchema.parse(await readJson(req));
      const startMode = payload.startMode ?? "new";
      const requestedTargetDirectory = normalizeTargetDirectory(payload.targetDirectory);
      const targetDirectory = await resolveSessionTargetDirectory(requestedTargetDirectory, startMode);
      const session = sessionStore.createSession(payload.request, targetDirectory, startMode);
      void runSession(session.id, payload.request, targetDirectory, startMode);
      return sendJson(res, 202, session);
    }

    const sessionMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (method === "GET" && sessionMatch?.[1]) {
      const session = sessionStore.getSession(sessionMatch[1]);
      if (!session) {
        return sendJson(res, 404, { error: "세션을 찾을 수 없습니다." });
      }
      return sendJson(res, 200, session);
    }

    const clarificationMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)\/clarifications$/);
    if (method === "POST" && clarificationMatch?.[1]) {
      const sessionId = clarificationMatch[1];
      if (!sessionStore.getSession(sessionId)) {
        return sendJson(res, 404, { error: "세션을 찾을 수 없습니다." });
      }

      const payload = submitClarificationSchema.parse(await readJson(req));
      sessionStore.setStatus(sessionId, "running");
      const snapshot = sessionStore.submitClarificationAnswers(sessionId, payload.answers as ClarificationAnswer[]);
      return sendJson(res, 202, snapshot);
    }

    const eventMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
    if (method === "GET" && eventMatch?.[1]) {
      return handleSse(eventMatch[1], res);
    }

    const artifactMatch = requestUrl.pathname.match(/^\/api\/sessions\/([^/]+)\/artifacts\/([^/]+)$/);
    if (method === "GET" && artifactMatch?.[1] && artifactMatch?.[2]) {
      const sessionId = artifactMatch[1];
      const filename = decodeURIComponent(artifactMatch[2]);
      const artifact = sessionStore.getArtifact(sessionId, filename);

      if (!artifact) {
        return sendJson(res, 404, { error: "산출물을 찾을 수 없습니다." });
      }

      res.writeHead(200, {
        "Content-Type": contentTypeFor(filename),
        "Content-Disposition": `attachment; filename="${path.basename(filename)}"`,
      });
      res.end(artifact.content);
      return;
    }

    if (method === "GET") {
      return serveStatic(requestUrl.pathname, res);
    }

    return sendJson(res, 404, { error: "요청 경로를 찾을 수 없습니다." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendJson(res, 500, { error: message });
  }
});

server.listen(config.port, () => {
  process.stdout.write(`멀티 에이전트 웹 UI가 http://127.0.0.1:${config.port} 에서 실행 중입니다.\n`);
});

async function runSession(
  sessionId: string,
  userRequest: string,
  targetDirectory?: string,
  startMode: ProjectStartMode = "continue",
): Promise<void> {
  sessionStore.setStatus(sessionId, "running");

  try {
    const sessionOutputDir = path.resolve(config.outputDir, sessionId);
    const orchestrator = new MultiAgentOrchestrator({
      client,
      codegenClient,
      outputDir: sessionOutputDir,
      ...(targetDirectory
        ? {
            codeOutputDir: targetDirectory,
            codePathPrefix: "",
          }
        : {}),
      projectStartMode: startMode,
      hooks: {
        onMessage(message) {
          sessionStore.appendMessage(sessionId, message);
        },
        onPhase(phase) {
          sessionStore.updatePhase(sessionId, phase);
        },
        onArtifacts(artifacts) {
          sessionStore.setArtifacts(sessionId, artifacts);
        },
        onCodeActivity(update) {
          sessionStore.setCodeActivity(sessionId, update);
        },
        async onClarificationRequest(plan) {
          sessionStore.setStatus(sessionId, "waiting_input");
          const answers = await sessionStore.requestClarification(sessionId, plan);
          sessionStore.setStatus(sessionId, "running");
          return answers;
        },
      },
    });

    await orchestrator.run(userRequest);
    sessionStore.setStatus(sessionId, "completed");

    if (targetDirectory) {
      sessionStore.setPreview(sessionId, {
        status: "starting",
        detail: "생성된 앱 미리보기를 준비 중입니다.",
        targetDirectory,
        updatedAt: new Date().toISOString(),
      });

      void (async () => {
        const preview = await startWorkspacePreview(targetDirectory);
        sessionStore.setPreview(sessionId, {
          status: preview.ok ? "ready" : "failed",
          detail: preview.detail,
          ...(preview.ok ? { url: preview.url } : {}),
          targetDirectory,
          updatedAt: new Date().toISOString(),
        });
      })();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sessionStore.markActivePhaseFailed(sessionId, message);
    sessionStore.setStatus(sessionId, "failed", message);
    if (targetDirectory) {
      sessionStore.setPreview(sessionId, {
        status: "starting",
        detail: "실패했지만 지금까지 생성된 코드를 미리보기로 준비 중입니다.",
        targetDirectory,
        updatedAt: new Date().toISOString(),
      });
      void (async () => {
        const preview = await startWorkspacePreview(targetDirectory);
        sessionStore.setPreview(sessionId, {
          status: preview.ok ? "ready" : "failed",
          detail: preview.ok
            ? "검증은 실패했지만 지금까지 생성된 코드를 미리보기로 확인할 수 있습니다."
            : preview.detail,
          ...(preview.ok ? { url: preview.url } : {}),
          targetDirectory,
          updatedAt: new Date().toISOString(),
        });
      })();
    }
  }
}

function handleSse(sessionId: string, res: import("node:http").ServerResponse): void {
  const snapshot = sessionStore.getSession(sessionId);
  if (!snapshot) {
    sendJson(res, 404, { error: "세션을 찾을 수 없습니다." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write("retry: 1000\n\n");
  res.write("event: snapshot\n");
  res.write(`data: ${JSON.stringify({ type: "snapshot", snapshot })}\n\n`);

  const unsubscribe = sessionStore.subscribe(sessionId, (event) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  if (!unsubscribe) {
    res.end();
    return;
  }

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  res.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

async function serveStatic(requestPath: string, res: import("node:http").ServerResponse): Promise<void> {
  const pathname = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.resolve(publicRoot, `.${pathname}`);
  if (!filePath.startsWith(publicRoot)) {
    sendJson(res, 403, { error: "접근이 허용되지 않습니다." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(res, 404, { error: "파일을 찾을 수 없습니다." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
    });
    createReadStream(filePath).pipe(res);
  } catch {
    if (pathname !== "/index.html" && !path.extname(pathname)) {
      return serveStatic("/", res);
    }
    sendJson(res, 404, { error: "파일을 찾을 수 없습니다." });
  }
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (filePath.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
    return "text/plain; charset=utf-8";
  }
  return "text/plain; charset=utf-8";
}

async function readJson(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}

function sendJson(res: import("node:http").ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function normalizeTargetDirectory(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  return path.resolve(config.cwd, raw);
}

async function inspectProjectTarget(targetDirectory: string | undefined): Promise<{
  targetDirectory: string;
  exists: boolean;
  hasProjectMemory: boolean;
  mode: "new" | "continue";
  appName?: string;
  primaryGoal?: string;
  recentRequests: string[];
  workspaceFileCount: number;
  workspacePreview: string[];
  unresolvedFindings: string[];
}> {
  const resolvedTarget = targetDirectory ?? resolveDefaultTargetDirectory();
  const exists = await isDirectory(resolvedTarget);
  const projectMemory = await loadProjectMemory(resolvedTarget);
  const workspaceFiles = exists ? await listWorkspaceFiles(resolvedTarget).catch(() => [] as string[]) : [];
  const hasProjectMemory = Boolean(projectMemory);
  const mode: "new" | "continue" = hasProjectMemory || workspaceFiles.length > 0 ? "continue" : "new";

  return {
    targetDirectory: resolvedTarget,
    exists,
    hasProjectMemory,
    mode,
    ...(projectMemory?.latestBuildBrief
      ? {
          appName: projectMemory.latestBuildBrief.appName,
          primaryGoal: projectMemory.latestBuildBrief.primaryGoal,
        }
      : {}),
    recentRequests: projectMemory?.requestHistory.slice(-3).map((item) => item.request) ?? [],
    workspaceFileCount: workspaceFiles.length,
    workspacePreview: workspaceFiles.slice(0, 8),
    unresolvedFindings: projectMemory?.unresolvedFindings.slice(0, 4) ?? [],
  };
}

async function resolveSessionTargetDirectory(
  targetDirectory: string | undefined,
  _startMode: ProjectStartMode,
): Promise<string | undefined> {
  return targetDirectory ?? resolveDefaultTargetDirectory();
}


async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const targetStat = await stat(targetPath);
    return targetStat.isDirectory();
  } catch {
    return false;
  }
}
