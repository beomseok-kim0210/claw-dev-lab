import type { AgentRole, ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import type { BuildBrief, GeneratedCodeBundle } from "../types/generation.js";

type CodingRole = Exclude<AgentRole, "pm">;
type AppLocale = "ko" | "en";
type ScenarioKind = "gesture-canvas" | "career-insight" | "collaboration-workspace" | "dashboard" | "generic";

type AppScenario = {
  kind: ScenarioKind;
  locale: AppLocale;
  eyebrow: string;
  headline: string;
  description: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  statusItems: string[];
  quickActions: Array<{ label: string; detail: string }>;
  stageTitle: string;
  stageDescription: string;
  stagePanels: Array<{ label: string; value: string; detail: string }>;
  flowSteps: string[];
  callout: string;
};

type InsightCard = {
  title: string;
  summary: string;
  bullets: string[];
};

const FALLBACK_PROJECT_PATHS = [
  "package.json",
  "tsconfig.json",
  "src/server.ts",
  "src/shared/contracts.ts",
  "src/lib/domain.ts",
  "public/index.html",
  "public/app.js",
  "public/styles.css",
  "tests/bootstrap.test.mjs",
  "tests/contracts.test.mjs",
  ".env.example",
  "Dockerfile",
  "ops/README.md",
] as const;

export function listFallbackProjectPaths(): string[] {
  return [...FALLBACK_PROJECT_PATHS];
}

export function buildFallbackCodeBundle(args: {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  existingFiles: string[];
}): GeneratedCodeBundle {
  if (args.role === "backend") {
    return {
      role: "backend",
      summary: "Created a domain-aware backend starter with bootstrap data for a product shell.",
      files: [
        { path: "package.json", purpose: "Node scripts and local dev dependencies", content: renderPackageJson(args.buildBrief.appName) },
        { path: "tsconfig.json", purpose: "TypeScript build configuration", content: renderTsconfig() },
        { path: "src/shared/contracts.ts", purpose: "Shared bootstrap payload and scenario types", content: renderContracts(args.buildBrief) },
        { path: "src/server.ts", purpose: "Static asset server plus bootstrap endpoint", content: renderServer() },
      ],
      validation: [
        "npm run build must succeed without third-party Node runtime dependencies.",
        "GET /api/health and GET /api/bootstrap must return 200.",
      ],
    };
  }

  if (args.role === "frontend") {
    return {
      role: "frontend",
      summary: "Created a mobile-friendly product shell with a real interaction stage.",
      files: [
        { path: "public/index.html", purpose: "App shell with hero, stage, and insight sections", content: renderSafeIndexHtml(args.buildBrief, args.userRequest) },
        { path: "public/app.js", purpose: "Bootstrap fetch and scenario-driven UI logic", content: renderSafeAppJs() },
        { path: "public/styles.css", purpose: "Visual system for scenario-driven generated apps", content: renderStyles() },
      ],
      validation: [
        "The first screen must show the core interaction instead of only listing brief items.",
        "The stage must remain usable on mobile and desktop.",
      ],
    };
  }

  if (args.role === "ai") {
    return {
      role: "ai",
      summary: "Created scenario and insight data that keep the generated app request-specific.",
      files: [{ path: "src/lib/domain.ts", purpose: "Scenario definition and insight cards", content: renderSafeDomain(args.buildBrief, args.userRequest) }],
      validation: [
        "Scenario copy must stay specific to the request.",
        "Insight cards must avoid placeholder or filler language.",
      ],
    };
  }

  if (args.role === "test") {
    return {
      role: "test",
      summary: "Created smoke tests and shared contract checks.",
      files: [
        { path: "tests/bootstrap.test.mjs", purpose: "Health and bootstrap smoke test", content: renderBootstrapTest() },
        { path: "tests/contracts.test.mjs", purpose: "Shared contract export test", content: renderContractsTest() },
      ],
      validation: [
        "npm test must pass after npm run build.",
        "Bootstrap payload drift must fail loudly.",
      ],
    };
  }

  return {
    role: "infra",
    summary: "Created environment and runbook files for local execution.",
    files: [
      { path: ".env.example", purpose: "Default local environment values", content: "PORT=4040\nNODE_ENV=development\n" },
      {
        path: "Dockerfile",
        purpose: "Development-friendly container",
        content: ["FROM node:22-alpine", "WORKDIR /app", "COPY package.json tsconfig.json ./", "RUN npm install", "COPY public ./public", "COPY src ./src", "COPY tests ./tests", "EXPOSE 4040", 'CMD ["npm", "run", "dev"]'].join("\n"),
      },
      { path: "ops/README.md", purpose: "Runbook for local execution and checks", content: renderSafeOpsReadme(args.buildBrief, args.userRequest) },
    ],
    validation: [
      "Local setup must remain straightforward.",
      "Container instructions must match the generated file layout.",
    ],
  };
}

function renderPackageJson(appName: string): string {
  return JSON.stringify(
    {
      name: slugify(appName) || "multi-agent-app",
      private: true,
      type: "module",
      scripts: {
        dev: "tsx src/server.ts",
        build: "tsc -p tsconfig.json",
        start: "node dist/server.js",
        test: "npm run build && node --test --test-concurrency=1 tests/*.test.mjs",
      },
      devDependencies: {
        "@types/node": "^24.5.2",
        tsx: "^4.20.5",
        typescript: "^5.9.2",
      },
    },
    null,
    2,
  );
}

function renderTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "dist",
        rootDir: "src",
        strict: true,
        skipLibCheck: true,
        types: ["node"],
      },
      include: ["src/**/*.ts"],
    },
    null,
    2,
  );
}

function renderContracts(buildBrief: BuildBrief): string {
  return [
    `export const APP_NAME = ${JSON.stringify(buildBrief.appName)};`,
    `export const APP_TITLE = ${JSON.stringify(buildBrief.primaryGoal)};`,
    `export const APP_TYPE = ${JSON.stringify(buildBrief.appType)};`,
    `export const TARGET_USERS = ${JSON.stringify(buildBrief.targetUsers, null, 2)};`,
    `export const EXPERIENCE_PRINCIPLES = ${JSON.stringify(buildBrief.experiencePrinciples, null, 2)};`,
    `export const FEATURES = ${JSON.stringify(buildBrief.keyFeatures, null, 2)};`,
    `export const SCREENS = ${JSON.stringify(buildBrief.screens, null, 2)};`,
    `export const ENTITIES = ${JSON.stringify(buildBrief.entities, null, 2)};`,
    `export const API_ENDPOINTS = ${JSON.stringify(buildBrief.apiEndpoints, null, 2)};`,
    `export const STACK = ${JSON.stringify(buildBrief.stack, null, 2)};`,
    `export const ACCEPTANCE_CHECKS = ${JSON.stringify(buildBrief.acceptanceChecks, null, 2)};`,
    `export const NOTES = ${JSON.stringify(buildBrief.notes, null, 2)};`,
    "",
    'export type ScenarioKind = "gesture-canvas" | "career-insight" | "collaboration-workspace" | "dashboard" | "generic";',
    'export type ScenarioAction = { label: string; detail: string; icon?: string; };',
    'export type ScenarioPanel = { label: string; value: string; detail: string; icon?: string; };',
    'export type AppScenario = { kind: ScenarioKind; locale: "ko" | "en"; eyebrow: string; headline: string; description: string; primaryActionLabel: string; secondaryActionLabel: string; statusItems: string[]; quickActions: ScenarioAction[]; stageTitle: string; stageDescription: string; stagePanels: ScenarioPanel[]; flowSteps: string[]; callout: string; };',
    'export type InsightCard = { title: string; summary: string; bullets: string[]; };',
    'export type BootstrapPayload = { appName: string; primaryGoal: string; appType: string; targetUsers: string[]; experiencePrinciples: string[]; features: string[]; screens: string[]; entities: string[]; apiEndpoints: string[]; stack: string[]; acceptanceChecks: string[]; notes: string[]; scenario: AppScenario; insightCards: InsightCard[]; };',
  ].join("\n");
}

function renderServer(): string {
  return [
    'import { createReadStream } from "node:fs";',
    'import { stat } from "node:fs/promises";',
    'import { createServer } from "node:http";',
    'import path from "node:path";',
    "",
    'import { buildAppScenario, buildInsightCards } from "./lib/domain.js";',
    'import { ACCEPTANCE_CHECKS, API_ENDPOINTS, APP_NAME, APP_TITLE, APP_TYPE, ENTITIES, EXPERIENCE_PRINCIPLES, FEATURES, NOTES, SCREENS, STACK, TARGET_USERS, type BootstrapPayload } from "./shared/contracts.js";',
    "",
    'const publicRoot = path.resolve(process.cwd(), "public");',
    'const port = Number(process.env.PORT ?? 4040);',
    "",
    "const server = createServer(async (req, res) => {",
    '  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);',
    '  if ((req.method ?? "GET") === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok: true, appName: APP_NAME, appType: APP_TYPE });',
    '  if ((req.method ?? "GET") === "GET" && url.pathname === "/api/bootstrap") {',
    "    const payload: BootstrapPayload = {",
    "      appName: APP_NAME, primaryGoal: APP_TITLE, appType: APP_TYPE, targetUsers: TARGET_USERS, experiencePrinciples: EXPERIENCE_PRINCIPLES, features: FEATURES, screens: SCREENS, entities: ENTITIES, apiEndpoints: API_ENDPOINTS, stack: STACK, acceptanceChecks: ACCEPTANCE_CHECKS, notes: NOTES, scenario: buildAppScenario(), insightCards: buildInsightCards(),",
    "    };",
    "    return sendJson(res, 200, payload);",
    "  }",
    '  if ((req.method ?? "GET") === "POST" && url.pathname === "/api/analyzeShape") {',
    "    const body = await readJson(req);",
    "    const coordinates = Array.isArray(body?.coordinates) ? body.coordinates : [];",
    '    return sendJson(res, 200, { shapeType: coordinates.length >= 2 ? "line" : "unknown", pointCount: coordinates.length });',
    "  }",
    '  if ((req.method ?? "GET") === "POST" && url.pathname === "/api/mapToParallelogram") {',
    "    const body = await readJson(req);",
    '    return sendJson(res, 200, { result: "success", targetShape: "parallelogram", sourceShape: body?.shapeType ?? "unknown", palette: body?.color ?? "default" });',
    "  }",
    "  return serveStatic(url.pathname, res);",
    "});",
    'server.listen(port, () => console.log(`app is running at http://127.0.0.1:${port}`));',
    "",
    'async function serveStatic(pathname: string, res: import("node:http").ServerResponse) {',
    '  const relativePath = pathname === "/" ? "/index.html" : pathname;',
    '  const filePath = path.resolve(publicRoot, `.${relativePath}`);',
    "  try { const fileStat = await stat(filePath); if (!fileStat.isFile()) return sendJson(res, 404, { error: \"Not found\" }); res.writeHead(200, { \"Content-Type\": contentTypeFor(filePath) }); createReadStream(filePath).pipe(res); } catch { sendJson(res, 404, { error: \"Not found\" }); }",
    "}",
    'async function readJson(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {',
    "  const chunks: Buffer[] = [];",
    "  for await (const chunk of req) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); }",
    "  if (chunks.length === 0) return {};",
    "  try { return JSON.parse(Buffer.concat(chunks).toString(\"utf8\")) as Record<string, unknown>; } catch { return {}; }",
    "}",
    'function sendJson(res: import("node:http").ServerResponse, statusCode: number, body: unknown) { res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); }',
    'function contentTypeFor(filePath: string) { if (filePath.endsWith(".html")) return "text/html; charset=utf-8"; if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8"; if (filePath.endsWith(".css")) return "text/css; charset=utf-8"; return "text/plain; charset=utf-8"; }',
  ].join("\n");
}

function renderSafeIndexHtml(buildBrief: BuildBrief, userRequest: string): string {
  const lang = detectSafeLocale(buildBrief, userRequest) === "ko" ? "ko" : "en";
  return [
    "<!doctype html>",
    `<html lang="${lang}">`,
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(buildBrief.appName)}</title>`,
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />',
    '  <link rel="stylesheet" href="/styles.css" />',
    "</head>",
    "<body>",
    '  <div class="ambient ambient-left"></div>',
    '  <div class="ambient ambient-right"></div>',
    '  <main class="shell">',
    '    <section class="panel hero">',
    '      <div class="hero-main">',
    '        <p class="eyebrow" id="heroEyebrow"></p>',
    '        <h1 id="heroHeadline"></h1>',
    '        <p class="hero-copy" id="heroDescription"></p>',
    '        <div class="hero-actions"><button id="primaryAction" class="primary-button" type="button"></button><button id="secondaryAction" class="ghost-button" type="button"></button></div>',
    '        <div id="statusChips" class="status-row"></div>',
    "      </div>",
    '      <aside class="hero-side"><article class="metric-card"><p class="metric-label">앱 유형</p><p class="metric-value" id="appType"></p></article><article class="metric-card"><p class="metric-label">핵심 기능</p><p class="metric-value" id="featureCount"></p></article><article class="metric-card"><p class="metric-label">주요 화면</p><p class="metric-value" id="screenCount"></p></article></aside>',
    "    </section>",
    '    <section class="panel workbench"><div class="section-head"><p class="eyebrow">핵심 상호작용</p><h2 id="stageTitle"></h2><p class="section-copy" id="stageDescription"></p></div><div id="interactiveStage" class="stage"></div></section>',
    '    <section class="grid three-up"><article class="panel mini"><h2>대상 사용자</h2><ul id="userList" class="bullet-list"></ul></article><article class="panel mini"><h2>경험 원칙</h2><ul id="principleList" class="bullet-list"></ul></article><article class="panel mini"><h2>기술 스택</h2><ul id="stackList" class="bullet-list"></ul></article></section>',
    '    <section class="panel"><div class="section-head compact"><p class="eyebrow">도메인 인사이트</p><h2>핵심 포인트</h2></div><div id="insightList" class="insight-grid"></div></section>',
    '    <section class="grid two-up"><article class="panel mini"><h2>사용 흐름</h2><ol id="flowList" class="flow-list"></ol></article><article class="panel mini"><h2>체크포인트</h2><ul id="noteList" class="bullet-list"></ul></article></section>',
    "  </main>",
    '  <script type="module" src="/app.js"></script>',
    "</body>",
    "</html>",
  ].join("\n");
}

function renderSafeAppJs(): string {
  return `
const state = { stream: null, drawing: false, lastPoint: null };
const byId = (id) => document.getElementById(id);

async function main() {
  const response = await fetch("/api/bootstrap");
  if (!response.ok) throw new Error("Failed to load bootstrap payload.");
  const payload = await response.json();
  renderShell(payload);
  renderStage(payload);
  bindActions(payload);
}

function renderShell(payload) {
  byId("heroEyebrow").textContent = payload.scenario.eyebrow;
  byId("heroHeadline").textContent = payload.scenario.headline;
  byId("heroDescription").textContent = payload.scenario.description;
  byId("appType").textContent = String(payload.appType).replaceAll("-", " ");
  byId("featureCount").textContent = String(payload.features.length);
  byId("screenCount").textContent = String(payload.screens.length);
  byId("stageTitle").textContent = payload.scenario.stageTitle;
  byId("stageDescription").textContent = payload.scenario.stageDescription;
  byId("primaryAction").textContent = payload.scenario.primaryActionLabel;
  byId("secondaryAction").textContent = payload.scenario.secondaryActionLabel;
  byId("statusChips").innerHTML = payload.scenario.statusItems.map((item) => '<span class="chip">' + escapeHtml(item) + "</span>").join("");
  renderList("userList", payload.targetUsers);
  renderList("principleList", payload.experiencePrinciples);
  renderList("stackList", payload.stack);
  renderList("noteList", payload.notes.concat(payload.acceptanceChecks).slice(0, 6));
  renderOrdered("flowList", payload.scenario.flowSteps);
  byId("insightList").innerHTML = payload.insightCards.map(renderInsightCard).join("");
}

function bindActions(payload) {
  byId("primaryAction").addEventListener("click", () => {
    if (payload.scenario.kind === "gesture-canvas") {
      void startCameraPreview();
      return;
    }
    byId("interactiveStage").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  byId("secondaryAction").addEventListener("click", () => {
    if (payload.scenario.kind === "gesture-canvas") {
      runGestureDemo();
      return;
    }
    byId("insightList").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderStage(payload) {
  if (payload.scenario.kind === "gesture-canvas") {
    renderGestureStage(payload);
    return;
  }
  byId("interactiveStage").innerHTML = '<div class="generic-stage"><section class="surface"><div class="panel-stack">' + payload.scenario.stagePanels.map(renderPanel).join("") + '</div></section><section class="surface"><div class="action-stack">' + payload.scenario.quickActions.map(renderAction).join("") + '</div><p class="callout">' + escapeHtml(payload.scenario.callout) + "</p></section></div>";
}

function renderGestureStage(payload) {
  byId("interactiveStage").innerHTML = '<div class="gesture-stage"><section class="surface"><div class="toolbar"><span class="chip" id="gestureChip">제스처 데모 모드</span><div class="toolbar-actions"><button id="startCameraInline" class="inline-button" type="button">카메라 시작</button><button id="clearCanvasInline" class="inline-button subtle" type="button">캔버스 비우기</button><button id="simulateCircleInline" class="inline-button subtle" type="button">원형 데모</button></div></div><div class="stage-grid"><div class="camera-frame"><video id="cameraFeed" autoplay playsinline muted></video><div class="overlay" id="cameraOverlay">카메라를 시작하면 여기서 실시간 프리뷰를 확인할 수 있습니다.</div></div><div class="canvas-frame"><canvas id="gestureCanvas"></canvas></div></div></section><aside class="gesture-side"><section class="surface"><div class="panel-stack">' + payload.scenario.stagePanels.map(renderPanel).join("") + '</div></section><section class="surface"><div class="action-stack">' + payload.scenario.quickActions.map(renderAction).join("") + '</div></section><section class="surface"><div id="gestureLog" class="log-list"></div></section></aside></div><section class="surface generated-zone" id="generatedZone"></section>';
  setupGestureCanvas();
  byId("startCameraInline").addEventListener("click", () => void startCameraPreview());
  byId("clearCanvasInline").addEventListener("click", () => clearCanvas());
  byId("simulateCircleInline").addEventListener("click", () => runGestureDemo());
  appendLog(payload.scenario.callout);
  renderGeneratedZone([
    { title: "카메라 입력 준비", body: "브라우저 권한이 허용되면 실시간 프리뷰로 입력 흐름을 확인할 수 있습니다." },
    { title: "MediaPipe 연결 지점", body: "현재는 데모 셸을 제공하고 이후 손 랜드마크 추적을 붙일 수 있습니다." },
  ]);
}

function setupGestureCanvas() {
  const canvas = byId("gestureCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  resizeCanvas(canvas);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = 6;
  context.strokeStyle = "#ff7b3d";
  canvas.addEventListener("pointerdown", (event) => {
    state.drawing = true;
    state.lastPoint = relativePoint(canvas, event);
    canvas.setPointerCapture(event.pointerId);
    appendLog("캔버스 그리기를 시작했습니다.");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing || !state.lastPoint) return;
    const nextPoint = relativePoint(canvas, event);
    context.beginPath();
    context.moveTo(state.lastPoint.x, state.lastPoint.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    state.lastPoint = nextPoint;
  });
  const stop = () => {
    state.drawing = false;
    state.lastPoint = null;
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);
  window.addEventListener("resize", () => resizeCanvas(canvas));
}

async function startCameraPreview() {
  const video = byId("cameraFeed");
  const overlay = byId("cameraOverlay");
  const chip = byId("gestureChip");
  if (!(video instanceof HTMLVideoElement)) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (overlay) overlay.textContent = "이 브라우저는 카메라 미리보기를 지원하지 않습니다.";
    appendLog("카메라 API를 사용할 수 없습니다.");
    return;
  }
  if (state.stream) {
    if (overlay) overlay.textContent = "카메라가 이미 연결되어 있습니다.";
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    video.srcObject = state.stream;
    if (overlay) overlay.textContent = "카메라 연결 완료. 손을 움직이며 레이아웃과 입력 흐름을 확인해보세요.";
    if (chip) chip.textContent = "카메라 연결 완료";
    appendLog("카메라 스트림을 시작했습니다.");
  } catch (error) {
    if (overlay) overlay.textContent = "카메라 권한을 가져오지 못했습니다. 데모 모드로 계속 확인할 수 있습니다.";
    appendLog(error instanceof Error ? error.message : String(error));
  }
}

function runGestureDemo() {
  const canvas = byId("gestureCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  clearCanvas();
  const radius = Math.min(canvas.width, canvas.height) * 0.22;
  context.beginPath();
  context.lineWidth = 8;
  context.strokeStyle = "#ff7b3d";
  context.arc(canvas.width * 0.5, canvas.height * 0.5, radius, 0, Math.PI * 2);
  context.stroke();
  appendLog("원형 제스처 데모를 실행했습니다.");
  renderGeneratedZone([
    { title: "도형 인식 포인트", body: "원형 패턴은 이후 이미지 반응이나 명령 분기로 연결할 수 있습니다." },
    { title: "상호작용 검증", body: "카메라 프리뷰, 캔버스 입력, 시각 반응이 같은 화면에서 이어져야 합니다." },
  ]);
}

function clearCanvas() {
  const canvas = byId("gestureCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffaf4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  appendLog("캔버스를 비웠습니다.");
}

function renderGeneratedZone(cards) {
  const zone = byId("generatedZone");
  if (!zone) return;
  zone.innerHTML = '<div class="section-head compact"><p class="eyebrow">실시간 결과</p><h2>제스처 반응 영역</h2></div><div class="generated-grid">' + cards.map((card) => '<article class="generated-card"><h3>' + escapeHtml(card.title) + '</h3><p>' + escapeHtml(card.body) + "</p></article>").join("") + "</div>";
}

function appendLog(message) {
  const node = byId("gestureLog");
  if (!node) return;
  const item = document.createElement("p");
  item.className = "log-entry";
  item.textContent = message;
  node.prepend(item);
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(rect.width));
  canvas.height = Math.max(360, Math.floor(rect.height || rect.width * 0.66));
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#fffaf4";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function relativePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function renderPanel(panel) { return '<article class="panel-card"><p class="panel-label">' + escapeHtml(panel.label) + '</p><p class="panel-value">' + escapeHtml(panel.value) + '</p><p class="panel-detail">' + escapeHtml(panel.detail) + "</p></article>"; }
function renderAction(action) { return '<article class="action-card"><h3>' + escapeHtml(action.label) + '</h3><p>' + escapeHtml(action.detail) + "</p></article>"; }
function renderInsightCard(card) { return '<article class="insight-card"><p class="eyebrow">Insight</p><h3>' + escapeHtml(card.title) + '</h3><p>' + escapeHtml(card.summary) + '</p><ul class="bullet-list compact">' + card.bullets.map((item) => '<li>' + escapeHtml(item) + "</li>").join("") + "</ul></article>"; }
function renderList(id, items) { byId(id).innerHTML = (items && items.length ? items : ["항목이 없습니다."]).map((item) => '<li>' + escapeHtml(item) + "</li>").join(""); }
function renderOrdered(id, items) { byId(id).innerHTML = (items && items.length ? items : ["다음 단계가 없습니다."]).map((item) => '<li>' + escapeHtml(item) + "</li>").join(""); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

void main().catch((error) => {
  console.error(error);
  const stage = byId("interactiveStage");
  if (stage) {
    stage.innerHTML = '<section class="surface"><h3>앱 초기화에 실패했습니다.</h3><p class="panel-detail">/api/bootstrap 응답과 생성된 스크립트를 다시 확인하세요.</p></section>';
  }
});
`.trim();
}

function renderSafeDomain(buildBrief: BuildBrief, userRequest: string): string {
  const scenario = buildSafeScenario(buildBrief, userRequest);
  const cards = buildSafeInsightCards(buildBrief, scenario);
  return [
    'import type { AppScenario, InsightCard } from "../shared/contracts.js";',
    "",
    `const SCENARIO: AppScenario = ${JSON.stringify(scenario, null, 2)};`,
    `const INSIGHT_CARDS: InsightCard[] = ${JSON.stringify(cards, null, 2)};`,
    "",
    "export function buildAppScenario(): AppScenario { return SCENARIO; }",
    "export function buildInsightCards(): InsightCard[] { return INSIGHT_CARDS; }",
  ].join("\n");
}

function renderSafeOpsReadme(buildBrief: BuildBrief, userRequest: string): string {
  const scenario = buildSafeScenario(buildBrief, userRequest);
  return [
    `# ${buildBrief.appName} Ops`,
    "",
    `- scenario: ${scenario.kind}`,
    `- locale: ${scenario.locale}`,
    "",
    "## Local Run",
    "- npm install --include=dev",
    "- npm run build",
    "- npm run dev",
    "",
    "## Smoke Checks",
    "- Open http://127.0.0.1:4040",
    "- Confirm /api/health returns app metadata",
    "- Confirm /api/bootstrap returns scenario and insight data",
    "- Run npm test and confirm the generated smoke tests pass",
    "",
    "## Primary Interaction Check",
    `- ${scenario.stageTitle}`,
    `- ${scenario.callout}`,
  ].join("\n");
}

function buildSafeScenario(buildBrief: BuildBrief, userRequest: string): AppScenario {
  const locale = detectSafeLocale(buildBrief, userRequest);
  const haystack = `${userRequest}\n${buildBrief.primaryGoal}\n${buildBrief.keyFeatures.join("\n")}\n${buildBrief.screens.join("\n")}`.toLowerCase();

  if (hasSafeKeyword(haystack, ["mediapipe", "media-pipe", "gesture", "camera", "canvas", "draw"])) {
    return locale === "ko"
      ? {
          kind: "gesture-canvas",
          locale,
          eyebrow: `${buildBrief.appName} / Gesture Studio`,
          headline: "카메라와 손 제스처로 그리는 실시간 캔버스",
          description: "카메라 프리뷰, 제스처 입력, 캔버스 반응을 한 화면에서 확인하는 데모 셸입니다.",
          primaryActionLabel: "카메라 시작",
          secondaryActionLabel: "원형 데모",
          statusItems: ["카메라 프리뷰", "제스처 입력", "실시간 캔버스", "모바일 대응"],
          quickActions: [
            { label: "카메라 연결", detail: "브라우저 권한과 프리뷰 레이아웃을 먼저 확인합니다." },
            { label: "캔버스 그리기", detail: "포인터 데모로 입력 흐름을 즉시 검증합니다." },
            { label: "MediaPipe 연결 준비", detail: "이후 손 랜드마크 추적을 붙일 자리를 확보합니다." },
          ],
          stageTitle: "핵심 인터랙션 데모",
          stageDescription: "사용자는 첫 화면에서 바로 입력, 반응, 시각 결과를 체감해야 합니다.",
          stagePanels: [
            { label: "입력", value: "카메라 + 제스처", detail: "손 동작 중심 입력 모델을 검증합니다." },
            { label: "반응", value: "실시간 캔버스", detail: "입력 직후 시각 피드백이 따라와야 합니다." },
            { label: "확장", value: "도형 명령", detail: "원형과 스와이프를 후속 명령으로 연결합니다." },
          ],
          flowSteps: ["카메라 연결", "입력 영역 확인", "제스처 또는 드로잉 입력", "반응 확인", "후속 기능 확장"],
          callout: "현재 버전은 제스처 셸과 캔버스 반응을 안정적으로 보여주는 데 집중합니다.",
        }
      : {
          kind: "gesture-canvas",
          locale,
          eyebrow: `${buildBrief.appName} / Gesture Studio`,
          headline: "A real-time canvas driven by camera and hand gestures",
          description: "This shell puts the camera preview, gesture input, and drawing response on the first screen.",
          primaryActionLabel: "Start camera",
          secondaryActionLabel: "Run circle demo",
          statusItems: ["camera preview", "gesture input", "live canvas", "mobile-ready"],
          quickActions: [
            { label: "connect camera", detail: "Validate permissions and framing first." },
            { label: "test drawing loop", detail: "Use a deterministic canvas reaction before full hand tracking." },
            { label: "prepare MediaPipe hook", detail: "Keep a clear slot for landmark tracking in the next step." },
          ],
          stageTitle: "Core interaction demo",
          stageDescription: "Users should understand the input and feedback loop on the first screen.",
          stagePanels: [
            { label: "input", value: "camera + hand", detail: "The input model should feel visible and tactile." },
            { label: "feedback", value: "live canvas", detail: "Every gesture should create immediate output." },
            { label: "expansion", value: "shape commands", detail: "Circle and swipe patterns can trigger later actions." },
          ],
          flowSteps: ["connect camera", "frame the hand zone", "capture input", "render feedback", "expand commands"],
          callout: "This version keeps the demo usable even before the full MediaPipe loop lands.",
        };
  }

  if (hasSafeKeyword(haystack, ["career", "job", "interview", "portfolio", "resume", "dejobyou"])) {
    return locale === "ko"
      ? {
          kind: "career-insight",
          locale,
          eyebrow: `${buildBrief.appName} / Career Insight`,
          headline: "기업 자료와 포트폴리오를 연결하는 취업 인사이트 앱",
          description: "단순 지원 추천이 아니라 어떤 포인트를 말해야 하는지 보여주는 모바일 중심 경험입니다.",
          primaryActionLabel: "기업 인사이트 보기",
          secondaryActionLabel: "포트폴리오 흐름 보기",
          statusItems: ["기업 신호 요약", "직무 포인트", "포트폴리오 연결", "모바일 중심"],
          quickActions: [
            { label: "기업/직무 검색", detail: "정확한 회사와 직무를 중심으로 인사이트를 찾습니다." },
            { label: "포트폴리오 업로드", detail: "프로젝트 경험과 성과를 구조화합니다." },
            { label: "면접 포인트 생성", detail: "사용자가 바로 말할 수 있는 포인트를 정리합니다." },
          ],
          stageTitle: "커리어 인사이트 워크벤치",
          stageDescription: "기업 자료, 직무 요구, 개인 경험이 한 흐름으로 이어져야 합니다.",
          stagePanels: [
            { label: "자료", value: "공시 + 뉴스 + 공고", detail: "기업이 실제로 내는 신호를 통합합니다." },
            { label: "개인 데이터", value: "포트폴리오 + 이력", detail: "개인 경험을 직무와 연결합니다." },
            { label: "출력", value: "자소서 + 면접 포인트", detail: "말하기 쉬운 형태로 정리합니다." },
          ],
          flowSteps: ["기업 선택", "직무 선택", "자료 수집", "포트폴리오 연결", "인사이트 생성"],
          callout: "사용자는 어디에 지원할지가 아니라 무엇을 강조할지를 얻어야 합니다.",
        }
      : {
          kind: "career-insight",
          locale,
          eyebrow: `${buildBrief.appName} / Career Insight`,
          headline: "A career app that connects company signals with portfolio evidence",
          description: "The product should surface what matters for the role and how the candidate should frame it.",
          primaryActionLabel: "Open company insight",
          secondaryActionLabel: "Open portfolio flow",
          statusItems: ["company signals", "role priorities", "portfolio mapping", "mobile-first"],
          quickActions: [
            { label: "search company and role", detail: "Start from the exact role instead of a broad feed." },
            { label: "upload portfolio", detail: "Extract wins and experience proof." },
            { label: "generate talking points", detail: "Turn evidence into self-intro and interview angles." },
          ],
          stageTitle: "Career insight workbench",
          stageDescription: "The first screen should explain what matters and how to frame it.",
          stagePanels: [
            { label: "sources", value: "filings + news + postings", detail: "Use company evidence, not generic advice." },
            { label: "candidate data", value: "portfolio + resume", detail: "Map personal proof to the target role." },
            { label: "result", value: "interview talking points", detail: "Make the output usable immediately." },
          ],
          flowSteps: ["pick company", "pick role", "collect evidence", "map portfolio", "generate talking points"],
          callout: "The user should leave with a sharper narrative, not only a score.",
        };
  }

  if (hasSafeKeyword(haystack, ["workspace", "collaboration", "multi-agent", "prd"])) {
    return locale === "ko"
      ? {
          kind: "collaboration-workspace",
          locale,
          eyebrow: `${buildBrief.appName} / Team Room`,
          headline: "토론, 결정, 구현이 한 흐름으로 이어지는 협업 워크스페이스",
          description: "여러 역할이 같은 요청을 중심으로 논의하고 코드까지 연결하는 공간입니다.",
          primaryActionLabel: "토론 흐름 보기",
          secondaryActionLabel: "결정 흐름 보기",
          statusItems: ["공유 대화", "PM 개입", "리뷰 루프", "실행 중심"],
          quickActions: [
            { label: "문제 정의", detail: "PM이 범위와 우선순위를 정리합니다." },
            { label: "역할별 실행", detail: "각 역할이 같은 목표 아래에서 파일을 수정합니다." },
            { label: "리뷰와 수정", detail: "검증 결과가 다음 수정 입력으로 이어집니다." },
          ],
          stageTitle: "협업 보드",
          stageDescription: "누가 무엇을 결정했고 다음으로 무엇을 해야 하는지가 바로 보여야 합니다.",
          stagePanels: [
            { label: "출발점", value: "사용자 요청", detail: "모든 논의는 같은 요청에서 출발합니다." },
            { label: "조율", value: "PM 우선순위", detail: "병목과 리스크를 PM이 정리합니다." },
            { label: "실행", value: "리뷰 후 수정", detail: "대화가 실제 파일 수정으로 이어집니다." },
          ],
          flowSteps: ["요청 정리", "자유 토론", "필요한 확인", "최종 결정", "구현과 리뷰"],
          callout: "채팅 로그만 예쁘게 보여주는 것이 아니라 실제 실행 루프가 보여야 합니다.",
        }
      : {
          kind: "collaboration-workspace",
          locale,
          eyebrow: `${buildBrief.appName} / Team Room`,
          headline: "A collaboration workspace where discussion, decisions, and delivery stay in one loop",
          description: "The product should feel like an execution room rather than a passive planning page.",
          primaryActionLabel: "Open discussion flow",
          secondaryActionLabel: "Open decision flow",
          statusItems: ["shared discussion", "PM steering", "review rounds", "delivery focus"],
          quickActions: [
            { label: "frame the problem", detail: "PM narrows scope and highlights bottlenecks." },
            { label: "show ownership", detail: "Each role should contribute inside the same room." },
            { label: "feed review forward", detail: "Validation and review must shape the next revision." },
          ],
          stageTitle: "Collaboration board",
          stageDescription: "Ownership, decisions, and next actions should be legible at a glance.",
          stagePanels: [
            { label: "origin", value: "user request", detail: "Everything traces back to the shared goal." },
            { label: "lead", value: "PM steering", detail: "PM closes ambiguity and reprioritizes the next move." },
            { label: "loop", value: "review to revise", detail: "Discussion must connect to file changes." },
          ],
          flowSteps: ["frame request", "debate", "clarify", "decide", "implement and review"],
          callout: "The workspace should read like an operating room for delivery.",
        };
  }

  return locale === "ko"
    ? {
        kind: "generic",
        locale,
        eyebrow: `${buildBrief.appName} / Generated App`,
        headline: buildBrief.primaryGoal,
        description: "첫 화면에서 핵심 상호작용을 보여주고 나머지 정보는 보조 카드로 정리하는 앱 셸입니다.",
        primaryActionLabel: "핵심 화면 보기",
        secondaryActionLabel: "인사이트 보기",
        statusItems: buildBrief.keyFeatures.slice(0, 4),
        quickActions: buildBrief.keyFeatures.slice(0, 3).map((item) => ({ label: item, detail: "첫 릴리스에서 바로 체감해야 하는 기능입니다." })),
        stageTitle: "핵심 제품 스테이지",
        stageDescription: "문서 요약이 아니라 핵심 동작이 먼저 보이는 화면이어야 합니다.",
        stagePanels: [
          { label: "목표", value: buildBrief.primaryGoal, detail: "첫 화면에서 이 목표가 보이게 만듭니다." },
          { label: "사용자", value: buildBrief.targetUsers[0] ?? "사용자", detail: "누구를 위한 제품인지 명확해야 합니다." },
          { label: "검증 기준", value: buildBrief.acceptanceChecks[0] ?? "검증 기준", detail: "완성도를 판단하는 기준입니다." },
        ],
        flowSteps: ["핵심 화면 진입", "상태 확인", "결과 확인", "다음 액션 선택"],
        callout: "생성된 앱은 문서 뷰어가 아니라 최소한의 제품 감각을 줘야 합니다.",
      }
    : {
        kind: "generic",
        locale,
        eyebrow: `${buildBrief.appName} / Generated App`,
        headline: buildBrief.primaryGoal,
        description: "The first screen should show the core interaction before it expands into supporting details.",
        primaryActionLabel: "Open core surface",
        secondaryActionLabel: "Open insights",
        statusItems: buildBrief.keyFeatures.slice(0, 4),
        quickActions: buildBrief.keyFeatures.slice(0, 3).map((item) => ({ label: item, detail: "This should feel tangible in the first release." })),
        stageTitle: "Primary product surface",
        stageDescription: "The main interaction should come first, with planning details moved into supporting cards.",
        stagePanels: [
          { label: "goal", value: buildBrief.primaryGoal, detail: "The first screen should make this tangible." },
          { label: "user", value: buildBrief.targetUsers[0] ?? "user", detail: "Keep the main audience obvious." },
          { label: "check", value: buildBrief.acceptanceChecks[0] ?? "validation gate", detail: "Use it to judge whether the shell feels done." },
        ],
        flowSteps: ["enter core action", "check main state", "review outcome", "take next step"],
        callout: "At minimum, the generated app should feel like a product shell.",
      };
}

function buildSafeInsightCards(buildBrief: BuildBrief, scenario: AppScenario): InsightCard[] {
  return scenario.locale === "ko"
    ? [
        { title: "핵심 가치", summary: scenario.description, bullets: buildBrief.keyFeatures.slice(0, 3) },
        { title: "첫 화면 우선순위", summary: scenario.stageDescription, bullets: scenario.flowSteps.slice(0, 3) },
        { title: "검증 포인트", summary: "처음 보는 사용자도 핵심 흐름을 이해할 수 있어야 합니다.", bullets: buildBrief.acceptanceChecks.slice(0, 3) },
      ]
    : [
        { title: "Core Value", summary: scenario.description, bullets: buildBrief.keyFeatures.slice(0, 3) },
        { title: "First-Screen Priority", summary: scenario.stageDescription, bullets: scenario.flowSteps.slice(0, 3) },
        { title: "Validation Gate", summary: "A first-time user should understand the core loop without extra explanation.", bullets: buildBrief.acceptanceChecks.slice(0, 3) },
      ];
}

function detectSafeLocale(buildBrief: BuildBrief, userRequest: string): AppLocale {
  return /[가-힣]/u.test(`${userRequest}\n${buildBrief.primaryGoal}`) ? "ko" : "en";
}

function hasSafeKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function renderIndexHtml(buildBrief: BuildBrief, userRequest: string): string {
  const lang = detectLocale(buildBrief, userRequest) === "ko" ? "ko" : "en";
  return [
    "<!doctype html>",
    `<html lang="${lang}">`,
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(buildBrief.appName)}</title>`,
    '  <link rel="preconnect" href="https://fonts.googleapis.com" />',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />',
    '  <link rel="stylesheet" href="/styles.css" />',
    "</head>",
    "<body>",
    '  <div class="ambient ambient-left"></div><div class="ambient ambient-right"></div>',
    '  <main class="shell">',
    '    <section class="panel hero">',
    '      <div class="hero-main"><p class="eyebrow" id="heroEyebrow"></p><h1 id="heroHeadline"></h1><p class="hero-copy" id="heroDescription"></p><div class="hero-actions"><button id="primaryAction" class="primary-button" type="button"></button><button id="secondaryAction" class="ghost-button" type="button"></button></div><div id="statusChips" class="status-row"></div></div>',
    '      <aside class="hero-side"><article class="metric-card"><p class="metric-label">앱 유형</p><p class="metric-value" id="appType"></p></article><article class="metric-card"><p class="metric-label">핵심 기능</p><p class="metric-value" id="featureCount"></p></article><article class="metric-card"><p class="metric-label">주요 화면</p><p class="metric-value" id="screenCount"></p></article></aside>',
    "    </section>",
    '    <section class="panel workbench"><div class="section-head"><p class="eyebrow">핵심 상호작용</p><h2 id="stageTitle"></h2><p class="section-copy" id="stageDescription"></p></div><div id="interactiveStage" class="stage"></div></section>',
    '    <section class="grid three-up"><article class="panel mini"><h2>핵심 사용자</h2><ul id="userList" class="bullet-list"></ul></article><article class="panel mini"><h2>경험 원칙</h2><ul id="principleList" class="bullet-list"></ul></article><article class="panel mini"><h2>기술 스택</h2><ul id="stackList" class="bullet-list"></ul></article></section>',
    '    <section class="panel"><div class="section-head compact"><p class="eyebrow">에이전트 인사이트</p><h2>주요 해석 포인트</h2></div><div id="insightList" class="insight-grid"></div></section>',
    '    <section class="grid two-up"><article class="panel mini"><h2>핵심 흐름</h2><ol id="flowList" class="flow-list"></ol></article><article class="panel mini"><h2>메모와 체크포인트</h2><ul id="noteList" class="bullet-list"></ul></article></section>',
    "  </main>",
    '  <script type="module" src="/app.js"></script>',
    "</body></html>",
  ].join("\n");
}

function renderAppJs(): string {
  return `
const state = { stream: null, drawing: false, lastPoint: null };
const byId = (id) => document.getElementById(id);

async function main() {
  const response = await fetch("/api/bootstrap");
  const payload = await response.json();
  renderShell(payload);
  renderStage(payload);
  bindHeroActions(payload);
}

function renderShell(payload) {
  byId("heroEyebrow").textContent = payload.scenario.eyebrow;
  byId("heroHeadline").textContent = payload.scenario.headline;
  byId("heroDescription").textContent = payload.scenario.description;
  byId("appType").textContent = String(payload.appType).replaceAll("-", " ");
  byId("featureCount").textContent = String(payload.features.length);
  byId("screenCount").textContent = String(payload.screens.length);
  byId("stageTitle").textContent = payload.scenario.stageTitle;
  byId("stageDescription").textContent = payload.scenario.stageDescription;
  byId("primaryAction").textContent = payload.scenario.primaryActionLabel;
  byId("secondaryAction").textContent = payload.scenario.secondaryActionLabel;
  byId("statusChips").innerHTML = payload.scenario.statusItems.map((item) => '<span class="chip">' + escapeHtml(item) + '</span>').join("");
  renderList("userList", payload.targetUsers);
  renderList("principleList", payload.experiencePrinciples);
  renderList("stackList", payload.stack);
  renderList("noteList", payload.notes.concat(payload.acceptanceChecks).slice(0, 7));
  renderOrdered("flowList", payload.scenario.flowSteps);
  byId("insightList").innerHTML = payload.insightCards.map(renderInsightCard).join("");
}

function bindHeroActions(payload) {
  byId("primaryAction").addEventListener("click", () => {
    if (payload.scenario.kind === "gesture-canvas") {
      void startCameraPreview();
      return;
    }
    byId("interactiveStage")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  byId("secondaryAction").addEventListener("click", () => {
    if (payload.scenario.kind === "gesture-canvas") {
      runGestureDemo();
      return;
    }
    byId("insightList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderStage(payload) {
  if (payload.scenario.kind === "gesture-canvas") {
    renderGestureStage(payload);
    return;
  }

  byId("interactiveStage").innerHTML = [
    '<div class="generic-stage">',
    '  <section class="surface"><div class="panel-stack">' + payload.scenario.stagePanels.map(renderPanel).join("") + '</div></section>',
    '  <section class="surface"><div class="action-stack">' + payload.scenario.quickActions.map(renderAction).join("") + '</div><p class="callout">' + escapeHtml(payload.scenario.callout) + '</p></section>',
    '</div>',
  ].join("");
}

function renderGestureStage(payload) {
  byId("interactiveStage").innerHTML = [
    '<div class="gesture-stage">',
    '  <section class="surface"><div class="toolbar"><span class="chip" id="gestureChip">포인터 데모 모드</span><div class="toolbar-actions"><button id="startCameraInline" class="inline-button" type="button">카메라 연결</button><button id="clearCanvasInline" class="inline-button subtle" type="button">캔버스 비우기</button><button id="simulateCircleInline" class="inline-button subtle" type="button">원 제스처 데모</button></div></div><div class="stage-grid"><div class="camera-frame"><video id="cameraFeed" autoplay playsinline muted></video><div class="overlay" id="cameraOverlay">카메라를 시작하면 손 제스처 추적 영역을 여기서 확인할 수 있습니다.</div></div><div class="canvas-frame"><canvas id="gestureCanvas"></canvas></div></div></section>',
    '  <aside class="gesture-side"><section class="surface"><div class="panel-stack">' + payload.scenario.stagePanels.map(renderPanel).join("") + '</div></section><section class="surface"><div class="action-stack">' + payload.scenario.quickActions.map(renderAction).join("") + '</div></section><section class="surface"><div id="gestureLog" class="log-list"></div></section></aside>',
    '</div><section class="surface generated-zone" id="generatedZone"></section>',
  ].join("");
  setupGestureCanvas();
  byId("startCameraInline").addEventListener("click", () => void startCameraPreview());
  byId("clearCanvasInline").addEventListener("click", () => clearCanvas());
  byId("simulateCircleInline").addEventListener("click", () => runGestureDemo());
  appendLog(payload.scenario.callout);
  renderGeneratedZone([
    { title: "실시간 출력 준비", body: "원을 그리면 이미지 추천이나 반응형 오브젝트를 쌓는 흐름으로 확장할 수 있습니다." },
    { title: "MediaPipe 연결 지점", body: "카메라 시작 시 CDN 런타임을 읽어 실제 핸드 트래킹 연결 가능성을 먼저 점검합니다." },
  ]);
}

function setupGestureCanvas() {
  const canvas = byId("gestureCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  resizeCanvas(canvas);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = 6;
  context.strokeStyle = "#ff7b3d";
  canvas.addEventListener("pointerdown", (event) => {
    state.drawing = true;
    state.lastPoint = relativePoint(canvas, event);
    canvas.setPointerCapture(event.pointerId);
    appendLog("포인터 기반 데모 드로잉을 시작했습니다.");
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing || !state.lastPoint) return;
    const nextPoint = relativePoint(canvas, event);
    context.beginPath();
    context.moveTo(state.lastPoint.x, state.lastPoint.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    state.lastPoint = nextPoint;
  });
  const stop = () => { state.drawing = false; state.lastPoint = null; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);
  window.addEventListener("resize", () => resizeCanvas(canvas));
}

async function startCameraPreview() {
  const video = byId("cameraFeed");
  const overlay = byId("cameraOverlay");
  const chip = byId("gestureChip");
  if (!(video instanceof HTMLVideoElement)) return;
  if (state.stream) {
    if (overlay) overlay.textContent = "카메라가 이미 연결되어 있습니다.";
    return;
  }
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 640 } }, audio: false });
    video.srcObject = state.stream;
    if (overlay) overlay.textContent = "카메라 연결 완료. 손을 움직여 추적 영역을 맞춰보세요.";
    if (chip) chip.textContent = "카메라 연결됨";
    appendLog("카메라 스트림을 시작했습니다.");
    void warmupMediaPipe();
  } catch (error) {
    if (overlay) overlay.textContent = "카메라 권한을 얻지 못했습니다. 포인터 데모 모드로 계속 확인할 수 있습니다.";
    appendLog(error instanceof Error ? error.message : String(error));
  }
}

async function warmupMediaPipe() {
  const chip = byId("gestureChip");
  try {
    await import("https://esm.sh/@mediapipe/tasks-vision@0.10.14");
    if (chip) chip.textContent = "MediaPipe 런타임 준비";
    appendLog("MediaPipe 런타임 모듈을 읽었습니다.");
  } catch {
    if (chip) chip.textContent = "포인터 데모 모드";
    appendLog("MediaPipe CDN 연결에 실패해 포인터 데모 모드로 유지합니다.");
  }
}

function runGestureDemo() {
  const canvas = byId("gestureCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  clearCanvas();
  const radius = Math.min(canvas.width, canvas.height) * 0.22;
  context.beginPath();
  context.lineWidth = 8;
  context.strokeStyle = "#ff7b3d";
  context.arc(canvas.width * 0.5, canvas.height * 0.5, radius, 0, Math.PI * 2);
  context.stroke();
  appendLog("원 제스처 시뮬레이션을 실행했습니다.");
  renderGeneratedZone([
    { title: "원형 제스처 인식", body: "원 패턴을 감지하면 관련 이미지나 브러시 템플릿을 추천하는 흐름으로 연결할 수 있습니다." },
    { title: "반응형 그림판 상태", body: "지금은 카메라 프리뷰와 캔버스 반응을 묶어 핵심 상호작용을 먼저 체감하게 했습니다." },
  ]);
}

function clearCanvas() {
  const canvas = byId("gestureCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fffaf4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  appendLog("캔버스를 비웠습니다.");
}

function renderGeneratedZone(cards) {
  const zone = byId("generatedZone");
  if (!zone) return;
  zone.innerHTML = '<div class="section-head compact"><p class="eyebrow">실시간 출력</p><h2>제스처 결과 영역</h2></div><div class="generated-grid">' + cards.map((card) => '<article class="generated-card"><h3>' + escapeHtml(card.title) + '</h3><p>' + escapeHtml(card.body) + '</p></article>').join("") + '</div>';
}

function appendLog(message) {
  const node = byId("gestureLog");
  if (!node) return;
  const item = document.createElement("p");
  item.className = "log-entry";
  item.textContent = message;
  node.prepend(item);
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(rect.width));
  canvas.height = Math.max(360, Math.floor(rect.height || rect.width * 0.66));
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#fffaf4";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function relativePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function renderPanel(panel) { return '<article class="panel-card"><p class="panel-label">' + escapeHtml(panel.label) + '</p><p class="panel-value">' + escapeHtml(panel.value) + '</p><p class="panel-detail">' + escapeHtml(panel.detail) + '</p></article>'; }
function renderAction(action) { return '<article class="action-card"><h3>' + escapeHtml(action.label) + '</h3><p>' + escapeHtml(action.detail) + '</p></article>'; }
function renderInsightCard(card) { return '<article class="insight-card"><p class="eyebrow">Insight</p><h3>' + escapeHtml(card.title) + '</h3><p>' + escapeHtml(card.summary) + '</p><ul class="bullet-list compact">' + card.bullets.map((item) => '<li>' + escapeHtml(item) + '</li>').join("") + '</ul></article>'; }
function renderList(id, items) { byId(id).innerHTML = (items && items.length ? items : ["항목이 없습니다."]).map((item) => '<li>' + escapeHtml(item) + '</li>').join(""); }
function renderOrdered(id, items) { byId(id).innerHTML = items.map((item) => '<li>' + escapeHtml(item) + '</li>').join(""); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

void main();
`.trim();
}

function renderStyles(): string {
  return `
:root { --bg:#f6efe5; --ink:#18201d; --muted:#5c6660; --line:rgba(24,32,29,.12); --panel:rgba(255,249,240,.88); --surface:rgba(255,252,246,.94); --accent:#ff7b3d; --teal:#0f766e; --navy:#1f3a5f; --shadow:0 28px 70px rgba(24,32,29,.12); }
* { box-sizing:border-box; } html, body { margin:0; min-height:100%; }
body { font-family:"Space Grotesk","Noto Sans KR",sans-serif; background:radial-gradient(circle at top left, rgba(15,118,110,.16), transparent 30%), radial-gradient(circle at right bottom, rgba(255,123,61,.16), transparent 26%), var(--bg); color:var(--ink); }
.ambient { position:fixed; border-radius:999px; filter:blur(72px); opacity:.45; pointer-events:none; } .ambient-left { inset:-8rem auto auto -8rem; width:20rem; height:20rem; background:rgba(15,118,110,.22); } .ambient-right { inset:auto -8rem -10rem auto; width:22rem; height:22rem; background:rgba(255,123,61,.18); }
.shell { position:relative; z-index:1; width:min(1200px, calc(100vw - 1rem)); margin:0 auto; padding:1rem 0 2rem; }
.panel, .surface { background:var(--panel); border:1px solid rgba(255,255,255,.72); border-radius:28px; box-shadow:var(--shadow); backdrop-filter:blur(18px); } .panel { padding:1rem; } .surface { padding:1rem; background:var(--surface); }
.hero { display:grid; gap:1rem; } .eyebrow, .metric-label, .panel-label { margin:0; font-size:.76rem; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
.hero h1 { margin:.35rem 0 0; line-height:.94; letter-spacing:-.05em; font-size:clamp(2.8rem, 10vw, 5.8rem); } .hero-copy, .section-copy, .panel-detail, .action-card p, .generated-card p, .insight-card p { margin:0; color:var(--muted); line-height:1.6; }
.hero-actions { display:flex; flex-direction:column; gap:.75rem; margin-top:1rem; } .primary-button, .ghost-button, .inline-button { appearance:none; border:none; cursor:pointer; font:inherit; border-radius:999px; font-weight:700; } .primary-button, .ghost-button { padding:.95rem 1.2rem; } .primary-button { background:var(--accent); color:#fff; } .ghost-button { background:rgba(255,255,255,.76); color:var(--ink); border:1px solid var(--line); }
.hero-side { display:grid; gap:.75rem; } .metric-card, .panel-card, .action-card, .generated-card, .insight-card { border:1px solid var(--line); border-radius:22px; background:rgba(255,255,255,.86); padding:1rem; } .metric-value, .panel-value { margin:.35rem 0 0; font-size:1.1rem; font-weight:700; } .status-row { display:flex; flex-wrap:wrap; gap:.55rem; margin-top:1rem; } .chip { display:inline-flex; padding:.42rem .75rem; border-radius:999px; background:rgba(15,118,110,.12); color:var(--teal); font-size:.82rem; font-weight:700; }
.workbench, .grid, .panel + .panel { margin-top:1rem; } .section-head { display:flex; flex-direction:column; gap:.25rem; margin-bottom:1rem; } .section-head h2 { margin:.15rem 0 0; line-height:1; letter-spacing:-.03em; }
.grid { display:grid; gap:1rem; } .bullet-list, .flow-list { margin:0; padding-left:1.1rem; line-height:1.65; } .compact { padding-left:1rem; }
.stage, .generic-stage, .gesture-stage, .generated-grid, .insight-grid, .panel-stack, .action-stack { display:grid; gap:1rem; } .toolbar { display:flex; flex-direction:column; gap:.75rem; margin-bottom:1rem; } .toolbar-actions { display:flex; flex-wrap:wrap; gap:.55rem; } .inline-button { padding:.72rem .95rem; background:var(--navy); color:#fff; font-size:.92rem; } .inline-button.subtle { background:rgba(24,32,29,.08); color:var(--ink); }
.stage-grid { display:grid; gap:1rem; } .camera-frame, .canvas-frame { position:relative; min-height:280px; border-radius:22px; overflow:hidden; background:linear-gradient(180deg,#1c2523,#273633); } .camera-frame video, .canvas-frame canvas { width:100%; height:100%; display:block; object-fit:cover; } .overlay { position:absolute; inset:auto 1rem 1rem 1rem; padding:.8rem .9rem; border-radius:16px; background:rgba(255,255,255,.9); line-height:1.5; } .canvas-frame canvas { background:radial-gradient(circle at top right, rgba(255,123,61,.15), transparent 26%), #fffaf4; }
.gesture-side, .log-list { display:grid; gap:.75rem; } .log-entry { margin:0; padding:.75rem .85rem; border-radius:16px; background:rgba(15,118,110,.08); line-height:1.45; } .generated-zone { margin-top:1rem; } .callout { margin:1rem 0 0; line-height:1.6; color:var(--muted); } .action-card h3, .generated-card h3, .insight-card h3 { margin:0 0 .35rem; }
@media (min-width:880px) { .shell { width:min(1320px, calc(100vw - 2rem)); padding-top:1.5rem; } .hero { grid-template-columns:minmax(0,1.4fr) minmax(280px,.72fr); } .hero-actions { flex-direction:row; flex-wrap:wrap; } .three-up { grid-template-columns:repeat(3,minmax(0,1fr)); } .two-up { grid-template-columns:repeat(2,minmax(0,1fr)); } .generic-stage { grid-template-columns:repeat(2,minmax(0,1fr)); } .gesture-stage { grid-template-columns:minmax(0,1.2fr) 320px; } .stage-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .generated-grid, .insight-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (min-width:1120px) { .generated-grid, .insight-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
`.trim();
}

function renderDomain(buildBrief: BuildBrief, userRequest: string): string {
  const scenario = buildScenario(buildBrief, userRequest);
  const cards = buildInsightCards(buildBrief, scenario);
  return [
    'import type { AppScenario, InsightCard } from "../shared/contracts.js";',
    "",
    `const SCENARIO: AppScenario = ${JSON.stringify(scenario, null, 2)};`,
    `const INSIGHT_CARDS: InsightCard[] = ${JSON.stringify(cards, null, 2)};`,
    "",
    "export function buildAppScenario(): AppScenario { return SCENARIO; }",
    "export function buildInsightCards(): InsightCard[] { return INSIGHT_CARDS; }",
  ].join("\n");
}

function renderOpsReadme(buildBrief: BuildBrief, userRequest: string): string {
  const scenario = buildScenario(buildBrief, userRequest);
  return [
    `# ${buildBrief.appName} Ops`,
    "",
    `- scenario: ${scenario.kind}`,
    `- locale: ${scenario.locale}`,
    "",
    "## Local Run",
    "- npm install --include=dev",
    "- npm run build",
    "- npm run dev",
    "",
    "## Smoke Checks",
    "- Open http://127.0.0.1:4040",
    "- Confirm /api/health returns app metadata",
    "- Confirm /api/bootstrap returns scenario and insight data",
    "- Run npm test and confirm the generated smoke tests pass",
    "",
    "## Primary Interaction Check",
    `- ${scenario.stageTitle}`,
    `- ${scenario.callout}`,
  ].join("\n");
}

function renderBootstrapTest(): string {
  return [
    'import assert from "node:assert/strict";',
    'import { spawn } from "node:child_process";',
    'import test from "node:test";',
    "",
    "const PORT = 4173;",
    "const BASE_URL = `http://127.0.0.1:${PORT}`;",
    'test("health and bootstrap endpoints respond", async (t) => {',
    '  const server = spawn(process.execPath, ["dist/server.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });',
    '  await t.test("wait for boot", async () => { await waitForServer(BASE_URL, 8000); });',
    '  t.after(() => { if (!server.killed) server.kill(); });',
    '  const health = await (await fetch(`${BASE_URL}/api/health`)).json();',
    "  assert.equal(health.ok, true);",
    '  const bootstrap = await (await fetch(`${BASE_URL}/api/bootstrap`)).json();',
    '  assert.equal(typeof bootstrap.appName, "string");',
    "  assert.ok(Array.isArray(bootstrap.features));",
    "  assert.ok(Array.isArray(bootstrap.insightCards));",
    '  assert.equal(typeof bootstrap.scenario.kind, "string");',
    "});",
    "async function waitForServer(baseUrl, timeoutMs) { const startedAt = Date.now(); while (Date.now() - startedAt < timeoutMs) { try { const response = await fetch(`${baseUrl}/api/health`); if (response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 200)); } throw new Error(\"Server did not become ready in time.\"); }",
  ].join("\n");
}

function renderContractsTest(): string {
  return [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    "",
    'import { ACCEPTANCE_CHECKS, API_ENDPOINTS, APP_NAME, EXPERIENCE_PRINCIPLES, FEATURES, NOTES, SCREENS, STACK, TARGET_USERS } from "../dist/shared/contracts.js";',
    'test("shared contract exports contain the required arrays", () => {',
    '  assert.equal(typeof APP_NAME, "string");',
    "  assert.ok(Array.isArray(TARGET_USERS));",
    "  assert.ok(Array.isArray(EXPERIENCE_PRINCIPLES));",
    "  assert.ok(Array.isArray(FEATURES));",
    "  assert.ok(Array.isArray(SCREENS));",
    "  assert.ok(Array.isArray(API_ENDPOINTS));",
    "  assert.ok(Array.isArray(STACK));",
    "  assert.ok(Array.isArray(ACCEPTANCE_CHECKS));",
    "  assert.ok(Array.isArray(NOTES));",
    "});",
  ].join("\n");
}

function buildScenario(buildBrief: BuildBrief, userRequest: string): AppScenario {
  const locale = detectLocale(buildBrief, userRequest);
  const haystack = `${userRequest}\n${buildBrief.primaryGoal}\n${buildBrief.keyFeatures.join("\n")}\n${buildBrief.screens.join("\n")}`.toLowerCase();

  if (hasKeyword(haystack, ["mediapipe", "media-pipe", "gesture", "hand", "camera", "canvas", "draw", "카메라", "손", "제스처", "그림판", "미디어 파이프"])) {
    return locale === "ko"
      ? { kind: "gesture-canvas", locale, eyebrow: `${buildBrief.appName} · MediaPipe Gesture Studio`, headline: "카메라와 손 제스처로 바로 반응하는 캔버스를 테스트하세요.", description: "실시간 카메라 프리뷰와 드로잉 캔버스를 한 화면에 묶어 MediaPipe 기반 인터랙션의 핵심 감각을 먼저 보여줍니다.", primaryActionLabel: "카메라 시작", secondaryActionLabel: "원 제스처 데모", statusItems: ["카메라 프리뷰", "제스처 매핑", "실시간 캔버스", "모바일 우선 레이아웃"], quickActions: [{ label: "카메라 스트림 확인", detail: "브라우저 권한을 받아 실시간 손 위치 확인 지점을 보여줍니다." }, { label: "드로잉 궤적 테스트", detail: "캔버스 위에 직접 선을 그리며 제스처-브러시 연결 감각을 먼저 검증합니다." }, { label: "원 제스처 후속 반응", detail: "원을 그렸을 때 이미지 추천이나 반응형 오브젝트를 띄우는 흐름을 준비합니다." }], stageTitle: "핸드 트래킹 데모 스테이지", stageDescription: "핵심은 손 제스처 입력, 실시간 피드백, 반응형 시각 결과를 한 번에 체감하게 만드는 것입니다.", stagePanels: [{ label: "입력 장치", value: "카메라 + 손 제스처", detail: "마우스/키보드 대신 손 움직임을 주 입력으로 잡습니다." }, { label: "즉시 결과", value: "캔버스 반응", detail: "제스처가 곧바로 시각적 출력으로 이어져야 합니다." }, { label: "확장 포인트", value: "도형 인식", detail: "원, 스와이프, 집기 같은 패턴을 이후 명령으로 연결할 수 있습니다." }], flowSteps: ["카메라 연결", "손 영역 보정", "궤적 입력", "패턴 감지", "시각 출력 반영"], callout: "지금 단계에서는 포인터 데모와 카메라 프리뷰를 제공하고 MediaPipe 연결 지점까지 준비합니다." }
      : { kind: "gesture-canvas", locale, eyebrow: `${buildBrief.appName} · MediaPipe Gesture Studio`, headline: "Test a camera-first gesture canvas before the full MediaPipe loop ships.", description: "The app combines a camera preview, a drawing surface, and a simulated circle gesture output so the first release already feels interactive.", primaryActionLabel: "Start camera", secondaryActionLabel: "Run circle demo", statusItems: ["camera preview", "gesture mapping", "live canvas", "mobile-first layout"], quickActions: [{ label: "camera stream", detail: "Verify the first-run browser permission and framing flow." }, { label: "drawing loop", detail: "Test the canvas reaction path before hand landmarks are fully wired in." }, { label: "shape trigger", detail: "Keep the circle gesture as the first deterministic trigger for a visual reaction." }], stageTitle: "Hand-tracking demo stage", stageDescription: "The first release should make the input loop visible, fast, and tactile.", stagePanels: [{ label: "input", value: "camera + hand", detail: "Replace mouse and keyboard with a visible camera interaction model." }, { label: "output", value: "canvas feedback", detail: "Every gesture should create an obvious visual response." }, { label: "expansion", value: "shape triggers", detail: "Circle, swipe, and pinch patterns can branch into later commands." }], flowSteps: ["connect camera", "calibrate hand zone", "capture stroke", "detect pattern", "apply visual response"], callout: "This version keeps the MediaPipe connection point ready while the canvas demo stays usable immediately." };
  }

  if (hasKeyword(haystack, ["career", "job", "interview", "portfolio", "resume", "dejobyou", "취준", "면접", "자소서", "공시", "뉴스룸", "포트폴리오"])) {
    return locale === "ko"
      ? { kind: "career-insight", locale, eyebrow: `${buildBrief.appName} · Career Insight Lab`, headline: "공시자료, 뉴스, 포트폴리오를 한 화면에서 연결하는 취업 인사이트 앱", description: "기업 자료와 개인 경험을 이어서 자소서와 면접 포인트를 뽑아내는 흐름을 첫 화면에서 바로 보여주는 구조입니다.", primaryActionLabel: "기업 인사이트 보기", secondaryActionLabel: "포트폴리오 흐름 보기", statusItems: ["기업 자료 요약", "직무 키워드 매핑", "포트폴리오 연결", "모바일 중심 UI"], quickActions: [{ label: "기업 / 직무 검색", detail: "원하는 회사와 직무를 기준으로 핵심 메시지를 먼저 모읍니다." }, { label: "포트폴리오 업로드", detail: "PDF와 슬라이드에서 경험, 성과, 기술 스택을 추출하는 흐름을 붙입니다." }, { label: "지원 포인트 추출", detail: "자소서와 면접에서 강조해야 할 포인트를 한 번에 보여줍니다." }], stageTitle: "취업 인사이트 워크벤치", stageDescription: "지원 추천이 아니라 무엇을 어떻게 말해야 할지를 연결해주는 화면이 중심입니다.", stagePanels: [{ label: "자료 소스", value: "공시 · 뉴스 · 채용공고", detail: "기업이 실제로 내는 메시지를 한 덩어리로 묶습니다." }, { label: "개인 데이터", value: "포트폴리오 · 이력", detail: "내 경험을 직무 요구와 직접 연결합니다." }, { label: "핵심 결과", value: "자소서 · 면접 포인트", detail: "말해야 할 포인트를 바로 쓰기 쉬운 형태로 정리합니다." }], flowSteps: ["기업 선택", "직무 선택", "자료 수집", "포트폴리오 연결", "지원 포인트 생성"], callout: "사용자는 어디 지원할지보다 왜 맞고 어떻게 말해야 하는지를 이 화면에서 확인하게 됩니다." }
      : { kind: "career-insight", locale, eyebrow: `${buildBrief.appName} · Career Insight Lab`, headline: "Turn company signals and portfolio evidence into interview-ready talking points.", description: "The experience centers on company evidence, role keywords, and portfolio proof instead of a generic job recommendation list.", primaryActionLabel: "Open company insight", secondaryActionLabel: "Open portfolio flow", statusItems: ["company evidence", "role mapping", "portfolio bridge", "mobile-first UI"], quickActions: [{ label: "search company + role", detail: "Start from the exact company and role rather than a broad feed." }, { label: "upload portfolio", detail: "Extract skills, wins, and project evidence from real candidate materials." }, { label: "surface talking points", detail: "Summarize what should become self-intro and interview highlights." }], stageTitle: "Career insight workbench", stageDescription: "The app should explain what matters and how the candidate should frame it.", stagePanels: [{ label: "sources", value: "filings + news", detail: "Use official and external company signals together." }, { label: "candidate data", value: "portfolio + resume", detail: "Map personal proof to role expectations." }, { label: "result", value: "interview talking points", detail: "Make the output usable in real applications." }], flowSteps: ["pick company", "pick role", "collect evidence", "map portfolio", "generate talking points"], callout: "The user should leave with actionable wording, not only a recommendation score." };
  }

  if (hasKeyword(haystack, ["workspace", "collaboration", "multi-agent", "prd", "협업", "토론", "워크스페이스"])) {
    return locale === "ko"
      ? { kind: "collaboration-workspace", locale, eyebrow: `${buildBrief.appName} · Team Room`, headline: "여러 역할이 한 화면에서 토론하고 결정하는 협업 워크스페이스", description: "토론, 결정, 구현 흐름을 분리하지 않고 같은 공간에서 이어지게 하는 협업형 제품 셸입니다.", primaryActionLabel: "토론 보드 보기", secondaryActionLabel: "결정 흐름 보기", statusItems: ["공유 채팅", "PM 개입", "리뷰 라운드", "실행 우선순위"], quickActions: [{ label: "의사결정 정리", detail: "PM이 범위를 좁히고 병목을 명확히 정리합니다." }, { label: "역할별 실행", detail: "각 역할이 같은 목표를 공유합니다." }, { label: "수정 라운드", detail: "리뷰와 검증 결과를 다시 다음 라운드 입력으로 사용합니다." }], stageTitle: "협업 보드", stageDescription: "누가 무엇을 결정했고 다음으로 무엇을 해야 하는지가 한 번에 보이는 구조입니다.", stagePanels: [{ label: "시작점", value: "사용자 요청", detail: "모든 토론과 구현의 공통 기준입니다." }, { label: "중심 역할", value: "PM 조정", detail: "충돌 우선순위와 범위 결정은 PM이 잡습니다." }, { label: "실행 연결", value: "리뷰 -> 수정", detail: "토론이 코드 수정 라운드로 직접 이어집니다." }], flowSteps: ["요청 정리", "자유 토론", "필수 확인", "최종 결정", "구현 및 리뷰"], callout: "보기 좋은 채팅이 아니라 실행 가능한 팀 흐름이 보여야 합니다." }
      : { kind: "collaboration-workspace", locale, eyebrow: `${buildBrief.appName} · Team Room`, headline: "A collaboration workspace where discussion, decisions, and delivery stay in the same loop.", description: "The app should feel like an execution room, not a static planning dashboard.", primaryActionLabel: "Open discussion board", secondaryActionLabel: "Open decision flow", statusItems: ["shared chat", "PM intervention", "review rounds", "execution priorities"], quickActions: [{ label: "decision framing", detail: "Keep PM-led scope narrowing and bottleneck summaries visible." }, { label: "role execution", detail: "Make each specialist contribution legible inside the same room." }, { label: "revision loop", detail: "Feed review and verification results back into the next revision round." }], stageTitle: "Collaboration board", stageDescription: "Users should see ownership, decisions, and next actions at a glance.", stagePanels: [{ label: "origin", value: "user request", detail: "Everything traces back to the shared request." }, { label: "lead", value: "PM steering", detail: "PM closes ambiguity and reprioritizes the next revision." }, { label: "loop", value: "review to revise", detail: "The flow should move from discussion to actual edits." }], flowSteps: ["frame request", "debate", "clarify", "decide", "implement and review"], callout: "The workspace should read like an operating room for delivery, not a summary page." };
  }

  if (hasKeyword(haystack, ["dashboard", "analytics", "metric", "insight", "report", "대시보드", "지표"])) {
    return locale === "ko"
      ? { kind: "dashboard", locale, eyebrow: `${buildBrief.appName} · Signal Console`, headline: "핵심 수치와 액션이 바로 읽히는 운영형 대시보드", description: "가만히 읽는 보고서보다 지금 무엇을 확인하고 어떤 결정을 내려야 하는지가 빠르게 읽히는 구성을 우선합니다.", primaryActionLabel: "핵심 지표 보기", secondaryActionLabel: "우선순위 보기", statusItems: ["실시간 감시", "우선순위 카드", "요약 지표", "반응형 레이아웃"], quickActions: [{ label: "우선순위 카드", detail: "사용자가 지금 가장 먼저 봐야 하는 지표를 앞으로 끌어냅니다." }, { label: "이상 징후 확인", detail: "정상/주의/위험 상태를 한 번에 읽을 수 있게 구성합니다." }, { label: "다음 액션 제안", detail: "단순 수치 나열보다 바로 실행할 액션을 붙입니다." }], stageTitle: "운영 대시보드 스테이지", stageDescription: "숫자, 경고, 추천 액션이 같은 리듬으로 이어지게 만드는 것이 중요합니다.", stagePanels: [{ label: "우선 지표", value: buildBrief.keyFeatures[0] ?? "핵심 기능", detail: "첫 시선이 머무는 메인 지표입니다." }, { label: "결정 포인트", value: buildBrief.acceptanceChecks[0] ?? "검증 기준", detail: "다음 판단의 기준이 되는 항목입니다." }, { label: "행동 유도", value: buildBrief.experiencePrinciples[0] ?? "명확한 다음 행동", detail: "대시보드가 행동으로 이어져야 합니다." }], flowSteps: ["상태 확인", "이상 징후 탐지", "우선순위 정렬", "실행 액션 선택"], callout: "좋은 대시보드는 예쁘게 나열하는 것이 아니라 바로 움직이게 만드는 것입니다." }
      : { kind: "dashboard", locale, eyebrow: `${buildBrief.appName} · Signal Console`, headline: "An operational dashboard that turns metrics into immediate action.", description: "The interface should be more about decisions than about passive reporting.", primaryActionLabel: "Open key metrics", secondaryActionLabel: "Open priorities", statusItems: ["live monitoring", "priority cards", "summary metrics", "responsive layout"], quickActions: [{ label: "priority cards", detail: "Pull the most important metric to the front." }, { label: "anomaly scan", detail: "Make healthy, warning, and risk states readable at a glance." }, { label: "next actions", detail: "Pair each signal with an obvious follow-up move." }], stageTitle: "Operations dashboard stage", stageDescription: "Metrics, alerts, and next steps should read as one system.", stagePanels: [{ label: "top metric", value: buildBrief.keyFeatures[0] ?? "key capability", detail: "This should dominate the first screen." }, { label: "decision cue", value: buildBrief.acceptanceChecks[0] ?? "validation gate", detail: "Use it to frame the next action." }, { label: "user motion", value: buildBrief.experiencePrinciples[0] ?? "clear next action", detail: "The dashboard should make the user move." }], flowSteps: ["check status", "scan anomalies", "sort priorities", "choose next action"], callout: "A strong dashboard is judged by clarity and pace, not by ornament alone." };
  }

  return locale === "ko"
    ? { kind: "generic", locale, eyebrow: `${buildBrief.appName} · Generated App`, headline: buildBrief.primaryGoal, description: "요청에서 가장 중요한 기능을 먼저 체감하게 하는 화면을 기본으로 삼고 나머지 정보는 주변 카드로 정리합니다.", primaryActionLabel: "핵심 화면 보기", secondaryActionLabel: "인사이트 보기", statusItems: buildBrief.keyFeatures.slice(0, 4), quickActions: buildBrief.keyFeatures.slice(0, 3).map((item) => ({ label: item, detail: "첫 릴리스에서 바로 체감되어야 하는 기능입니다." })), stageTitle: "핵심 제품 스테이지", stageDescription: "문서 요약이 아니라 제품의 주 동작이 앞에 나와야 합니다.", stagePanels: [{ label: "핵심 목표", value: buildBrief.primaryGoal, detail: "첫 화면이 이 목표를 바로 보여줘야 합니다." }, { label: "핵심 사용자", value: buildBrief.targetUsers[0] ?? "사용자", detail: "누구를 위한 제품인지 흐리지 않아야 합니다." }, { label: "핵심 체크", value: buildBrief.acceptanceChecks[0] ?? "검증 기준", detail: "완성 여부를 판단할 기준입니다." }], flowSteps: ["핵심 작업 진입", "주요 상태 확인", "결과 확인", "다음 액션 수행"], callout: "생성된 앱은 적어도 요청의 핵심 상호작용을 첫 화면에서 보여줘야 합니다." }
    : { kind: "generic", locale, eyebrow: `${buildBrief.appName} · Generated App`, headline: buildBrief.primaryGoal, description: "The first screen should demonstrate the primary product action before it expands into supporting details.", primaryActionLabel: "Open core surface", secondaryActionLabel: "Open insights", statusItems: buildBrief.keyFeatures.slice(0, 4), quickActions: buildBrief.keyFeatures.slice(0, 3).map((item) => ({ label: item, detail: "This should feel real in the first release rather than staying descriptive only." })), stageTitle: "Primary product surface", stageDescription: "The main interaction should come first, with planning details moved to supporting cards.", stagePanels: [{ label: "goal", value: buildBrief.primaryGoal, detail: "The first screen should make this tangible." }, { label: "user", value: buildBrief.targetUsers[0] ?? "user", detail: "Keep the main audience obvious." }, { label: "check", value: buildBrief.acceptanceChecks[0] ?? "validation gate", detail: "Use this to judge whether the shell feels done." }], flowSteps: ["enter core action", "check main state", "review outcome", "take next step"], callout: "At minimum, the generated app should feel like a product shell, not a brief viewer." };
}

function buildInsightCards(buildBrief: BuildBrief, scenario: AppScenario): InsightCard[] {
  return scenario.locale === "ko"
    ? [
        { title: "핵심 가치", summary: scenario.description, bullets: buildBrief.keyFeatures.slice(0, 3) },
        { title: "첫 화면 우선순위", summary: scenario.stageDescription, bullets: scenario.flowSteps.slice(0, 3) },
        { title: "완성 기준", summary: "처음 보는 사용자가 설명 없이도 핵심 기능 흐름을 이해해야 합니다.", bullets: buildBrief.acceptanceChecks.slice(0, 3) },
      ]
    : [
        { title: "Core Value", summary: scenario.description, bullets: buildBrief.keyFeatures.slice(0, 3) },
        { title: "First-Screen Priority", summary: scenario.stageDescription, bullets: scenario.flowSteps.slice(0, 3) },
        { title: "Definition of Done", summary: "A first-time user should understand the core loop without extra explanation.", bullets: buildBrief.acceptanceChecks.slice(0, 3) },
      ];
}

function detectLocale(buildBrief: BuildBrief, userRequest: string): AppLocale {
  return /[가-힣]/u.test(`${userRequest}\n${buildBrief.primaryGoal}`) ? "ko" : "en";
}

function hasKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
