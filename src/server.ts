import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { URL } from "node:url";

import { z } from "zod";

import { loadServerConfig } from "./config.js";
import { OllamaClient } from "./llm/ollamaClient.js";
import { MultiAgentOrchestrator } from "./orchestrator/multiAgentOrchestrator.js";
import { SessionStore } from "./server/sessionStore.js";
import type { ClarificationAnswer } from "./types/orchestration.js";

const createSessionSchema = z.object({
  request: z.string().trim().min(10).max(4000),
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
const client = new OllamaClient({
  baseUrl: config.ollamaBaseUrl,
  model: config.ollamaModel,
  timeoutMs: config.timeoutMs,
});

const publicRoot = path.resolve(config.cwd, "public");

const server = createServer(async (req, res) => {
  try {
    const method = req.method ?? "GET";
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

    if (method === "GET" && requestUrl.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        model: config.ollamaModel,
        baseUrl: config.ollamaBaseUrl,
      });
    }

    if (method === "POST" && requestUrl.pathname === "/api/sessions") {
      const payload = createSessionSchema.parse(await readJson(req));
      const session = sessionStore.createSession(payload.request);
      void runSession(session.id, payload.request);
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

async function runSession(sessionId: string, userRequest: string): Promise<void> {
  sessionStore.setStatus(sessionId, "running");

  try {
    const orchestrator = new MultiAgentOrchestrator({
      client,
      outputDir: path.resolve(config.outputDir, sessionId),
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sessionStore.markActivePhaseFailed(sessionId, message);
    sessionStore.setStatus(sessionId, "failed", message);
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
