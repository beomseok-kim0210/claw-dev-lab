import path from "node:path";

import type { AgentRole } from "../types/chat.js";
import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  InfraSpec,
  PMFinalDecision,
} from "../types/contracts.js";

type CodingRole = Exclude<AgentRole, "pm">;

export type PendingCodeArtifact = {
  filename: string;
  content: string;
  owner: CodingRole;
};

type CodeScaffolderArgs = {
  owner: CodingRole;
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
};

export function buildCodeArtifacts(args: CodeScaffolderArgs): PendingCodeArtifact[] {
  const meta = buildProjectMeta(args.userRequest, args.finalDecision);

  if (args.owner === "backend") {
    return [
      {
        owner: "backend",
        filename: path.posix.join("generated-app", "package.json"),
        content: renderPackageJson(meta.packageName),
      },
      {
        owner: "backend",
        filename: path.posix.join("generated-app", "tsconfig.json"),
        content: renderTsconfig(),
      },
      {
        owner: "backend",
        filename: path.posix.join("generated-app", "src", "shared", "contracts.ts"),
        content: renderContractsFile(meta.title, args.finalDecision, args.backendSpec, args.frontendSpec, args.aiFeaturesSpec, args.infraSpec),
      },
      {
        owner: "backend",
        filename: path.posix.join("generated-app", "src", "data", "store.ts"),
        content: renderStoreFile(),
      },
      {
        owner: "backend",
        filename: path.posix.join("generated-app", "src", "server.ts"),
        content: renderServerFile(meta.title),
      },
    ];
  }

  if (args.owner === "frontend") {
    return [
      {
        owner: "frontend",
        filename: path.posix.join("generated-app", "public", "index.html"),
        content: renderIndexHtml(meta.title),
      },
      {
        owner: "frontend",
        filename: path.posix.join("generated-app", "public", "app.js"),
        content: renderFrontendApp(meta.title, args.finalDecision, args.frontendSpec),
      },
      {
        owner: "frontend",
        filename: path.posix.join("generated-app", "public", "styles.css"),
        content: renderFrontendStyles(),
      },
    ];
  }

  if (args.owner === "infra") {
    return [
      {
        owner: "infra",
        filename: path.posix.join("generated-app", ".env.example"),
        content: renderEnvExample(),
      },
      {
        owner: "infra",
        filename: path.posix.join("generated-app", "Dockerfile"),
        content: renderDockerfile(),
      },
      {
        owner: "infra",
        filename: path.posix.join("generated-app", "docker-compose.yml"),
        content: renderComposeYaml(),
      },
      {
        owner: "infra",
        filename: path.posix.join("generated-app", "ops", "README.md"),
        content: renderOpsReadme(args.infraSpec),
      },
    ];
  }

  return [
    {
      owner: "ai",
      filename: path.posix.join("generated-app", "src", "lib", "prdEngine.ts"),
      content: renderPrdEngine(meta.title, args.finalDecision, args.aiFeaturesSpec),
    },
  ];
}

function buildProjectMeta(userRequest: string, finalDecision: PMFinalDecision): { title: string; packageName: string } {
  const headline = finalDecision.headline.trim() || "multi-agent-workspace";
  const title = headline.replace(/^제목:\s*/u, "").slice(0, 60);
  const packageName = slugify(`${title}-${userRequest}`.slice(0, 80));
  return {
    title,
    packageName: packageName.length > 0 ? packageName : "generated-multi-agent-app",
  };
}

function renderPackageJson(packageName: string): string {
  return JSON.stringify(
    {
      name: packageName,
      private: true,
      type: "module",
      scripts: {
        dev: "tsx src/server.ts",
        build: "tsc -p tsconfig.json",
        start: "node dist/server.js",
      },
      dependencies: {},
      devDependencies: {
        tsx: "^4.20.5",
        typescript: "^5.9.2",
        "@types/node": "^24.5.2",
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

function renderContractsFile(
  title: string,
  finalDecision: PMFinalDecision,
  backendSpec: BackendSpec,
  frontendSpec: FrontendSpec,
  aiFeaturesSpec: AIFeaturesSpec,
  infraSpec: InfraSpec,
): string {
  return [
    `export const PROJECT_TITLE = ${literal(title)};`,
    `export const FINAL_DECISION = ${literal(finalDecision.finalDecision)};`,
    `export const MVP_SCOPE = ${literalArray(finalDecision.mvpScope)};`,
    `export const API_NOTES = ${literalArray(backendSpec.apiDesign)};`,
    `export const UI_NOTES = ${literalArray(frontendSpec.components)};`,
    `export const AI_GUARDRAILS = ${literalArray(aiFeaturesSpec.guardrails)};`,
    `export const INFRA_NOTES = ${literalArray(infraSpec.operationsChecklist)};`,
    "",
    "export type FeatureCandidate = {",
    "  id: string;",
    "  name: string;",
    "  reason: string;",
    "};",
    "",
    "export type ReviewNote = {",
    "  title: string;",
    "  detail: string;",
    "};",
    "",
    "export type PrdDraft = {",
    "  id: string;",
    "  title: string;",
    "  summary: string;",
    "  features: FeatureCandidate[];",
    "  reviewNotes: ReviewNote[];",
    "  scope: string[];",
    "  updatedAt: string;",
    "};",
    "",
    "export type CreateProjectInput = {",
    "  request: string;",
    "};",
  ].join("\n");
}

function renderStoreFile(): string {
  return [
    "import { randomUUID } from \"node:crypto\";",
    "",
    "import type { PrdDraft } from \"../shared/contracts.js\";",
    "",
    "const drafts = new Map<string, PrdDraft>();",
    "",
    "export function saveDraft(draft: Omit<PrdDraft, \"id\" | \"updatedAt\">): PrdDraft {",
    "  const record: PrdDraft = {",
    "    ...draft,",
    "    id: randomUUID(),",
    "    updatedAt: new Date().toISOString(),",
    "  };",
    "  drafts.set(record.id, record);",
    "  return record;",
    "}",
    "",
    "export function listDrafts(): PrdDraft[] {",
    "  return [...drafts.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));",
    "}",
    "",
    "export function getDraft(id: string): PrdDraft | undefined {",
    "  return drafts.get(id);",
    "}",
  ].join("\n");
}

function renderServerFile(title: string): string {
  return [
    "import { createReadStream } from \"node:fs\";",
    "import { stat } from \"node:fs/promises\";",
    "import { createServer } from \"node:http\";",
    "import path from \"node:path\";",
    "",
    "import { generatePrdDraft } from \"./lib/prdEngine.js\";",
    "import { getDraft, listDrafts, saveDraft } from \"./data/store.js\";",
    "import { PROJECT_TITLE, type CreateProjectInput } from \"./shared/contracts.js\";",
    "",
    "const publicRoot = path.resolve(process.cwd(), \"public\");",
    "const port = Number(process.env.PORT ?? 4040);",
    "",
    "const server = createServer(async (req, res) => {",
    "  const url = new URL(req.url ?? \"/\", `http://${req.headers.host ?? \"127.0.0.1\"}`);",
    "  const method = req.method ?? \"GET\";",
    "",
    "  if (method === \"GET\" && url.pathname === \"/api/health\") {",
    "    return sendJson(res, 200, { ok: true, title: PROJECT_TITLE });",
    "  }",
    "",
    "  if (method === \"GET\" && url.pathname === \"/api/projects\") {",
    "    return sendJson(res, 200, { items: listDrafts() });",
    "  }",
    "",
    "  if (method === \"POST\" && url.pathname === \"/api/projects\") {",
    "    const payload = (await readJson(req)) as Partial<CreateProjectInput>;",
    "    if (!payload.request || payload.request.trim().length < 10) {",
    "      return sendJson(res, 400, { error: \"request는 10자 이상이어야 합니다.\" });",
    "    }",
    "",
    "    const generated = generatePrdDraft(payload.request.trim());",
    "    const saved = saveDraft(generated);",
    "    return sendJson(res, 201, saved);",
    "  }",
    "",
    "  const projectMatch = url.pathname.match(/^\\/api\\/projects\\/([^/]+)$/);",
    "  if (method === \"GET\" && projectMatch?.[1]) {",
    "    const item = getDraft(projectMatch[1]);",
    "    if (!item) {",
    "      return sendJson(res, 404, { error: \"초안을 찾을 수 없습니다.\" });",
    "    }",
    "    return sendJson(res, 200, item);",
    "  }",
    "",
    "  if (method === \"GET\") {",
    "    return serveStatic(url.pathname, res);",
    "  }",
    "",
    "  return sendJson(res, 404, { error: \"지원하지 않는 경로입니다.\" });",
    "});",
    "",
    "server.listen(port, () => {",
    `  console.log(${literal(`${title} starter is running at http://127.0.0.1:`)} + port);`,
    "});",
    "",
    "async function serveStatic(pathname: string, res: import(\"node:http\").ServerResponse) {",
    "  const relativePath = pathname === \"/\" ? \"/index.html\" : pathname;",
    "  const filePath = path.resolve(publicRoot, `.${relativePath}`);",
    "  if (!filePath.startsWith(publicRoot)) {",
    "    return sendJson(res, 403, { error: \"접근이 허용되지 않습니다.\" });",
    "  }",
    "",
    "  try {",
    "    const fileStat = await stat(filePath);",
    "    if (!fileStat.isFile()) {",
    "      return sendJson(res, 404, { error: \"파일을 찾을 수 없습니다.\" });",
    "    }",
    "",
    "    res.writeHead(200, { \"Content-Type\": contentTypeFor(filePath) });",
    "    createReadStream(filePath).pipe(res);",
    "  } catch {",
    "    return sendJson(res, 404, { error: \"파일을 찾을 수 없습니다.\" });",
    "  }",
    "}",
    "",
    "async function readJson(req: import(\"node:http\").IncomingMessage): Promise<unknown> {",
    "  const chunks: Buffer[] = [];",
    "  for await (const chunk of req) {",
    "    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));",
    "  }",
    "  const raw = Buffer.concat(chunks).toString(\"utf8\");",
    "  return raw.length > 0 ? JSON.parse(raw) : {};",
    "}",
    "",
    "function sendJson(res: import(\"node:http\").ServerResponse, statusCode: number, body: unknown) {",
    "  res.writeHead(statusCode, { \"Content-Type\": \"application/json; charset=utf-8\" });",
    "  res.end(JSON.stringify(body));",
    "}",
    "",
    "function contentTypeFor(filePath: string): string {",
    "  if (filePath.endsWith(\".html\")) return \"text/html; charset=utf-8\";",
    "  if (filePath.endsWith(\".js\")) return \"text/javascript; charset=utf-8\";",
    "  if (filePath.endsWith(\".css\")) return \"text/css; charset=utf-8\";",
    "  return \"text/plain; charset=utf-8\";",
    "}",
  ].join("\n");
}

function renderPrdEngine(title: string, finalDecision: PMFinalDecision, aiFeaturesSpec: AIFeaturesSpec): string {
  return [
    "import { AI_GUARDRAILS, MVP_SCOPE, type FeatureCandidate, type ReviewNote } from \"../shared/contracts.js\";",
    "",
    `const DEFAULT_TITLE = ${literal(title)};`,
    `const AI_FEATURES = ${literalArray(aiFeaturesSpec.features)};`,
    `const FEASIBILITY_NOTES = ${literalArray(aiFeaturesSpec.feasibilityNotes)};`,
    `const FINAL_DECISION = ${literal(finalDecision.finalDecision)};`,
    "",
    "export function generatePrdDraft(request: string) {",
    "  const normalized = request.trim();",
    "  const features = buildFeatureCandidates(normalized);",
    "  const reviewNotes = buildReviewNotes(normalized);",
    "",
    "  return {",
    "    title: DEFAULT_TITLE,",
    "    summary: FINAL_DECISION,",
    "    features,",
    "    reviewNotes,",
    "    scope: MVP_SCOPE,",
    "  };",
    "}",
    "",
    "function buildFeatureCandidates(request: string): FeatureCandidate[] {",
    "  const tokens = request",
    "    .split(/[,\\.\\n]/)",
    "    .map((item) => item.trim())",
    "    .filter((item) => item.length >= 4)",
    "    .slice(0, 4);",
    "",
    "  const seeded = tokens.length > 0 ? tokens : AI_FEATURES.slice(0, 3);",
    "  return seeded.map((item, index) => ({",
    "    id: `feature-${String(index + 1).padStart(2, \"0\")}`,",
    "    name: item,",
    "    reason: `요청 분석 결과와 AI 기능 제안 ${index + 1}을 반영한 항목입니다.`,",
    "  }));",
    "}",
    "",
    "function buildReviewNotes(request: string): ReviewNote[] {",
    "  return [",
    "    ...AI_GUARDRAILS.slice(0, 2).map((item, index) => ({",
    "      title: `가드레일 ${index + 1}`,",
    "      detail: item,",
    "    })),",
    "    {",
    "      title: \"검토 메모\",",
    "      detail: request.length > 140 ? FEASIBILITY_NOTES[0] ?? \"요청이 길어져 검토 포인트를 분리해야 합니다.\" : \"요청 길이가 적절하여 즉시 초안 생성이 가능합니다.\",",
    "    },",
    "  ];",
    "}",
  ].join("\n");
}

function renderIndexHtml(title: string): string {
  return [
    "<!doctype html>",
    "<html lang=\"ko\">",
    "  <head>",
    "    <meta charset=\"utf-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `    <title>${escapeHtml(title)}</title>`,
    "    <link rel=\"stylesheet\" href=\"/styles.css\" />",
    "  </head>",
    "  <body>",
    "    <main class=\"shell\">",
    "      <section class=\"hero\">",
    `        <p class=\"eyebrow\">${escapeHtml(title)}</p>`,
    "        <h1>PRD 요청에서 초안과 검토 포인트를 바로 만드는 스타터 앱</h1>",
    "        <p class=\"hero-copy\">요청을 입력하면 서버가 AI 엔진을 호출해 기능 후보, 검토 메모, MVP 범위를 정리합니다.</p>",
    "      </section>",
    "      <section class=\"composer\">",
    "        <textarea id=\"requestInput\" placeholder=\"예: B2B 고객용 PRD 협업 워크스페이스를 만들어줘\"></textarea>",
    "        <div class=\"actions\">",
    "          <button id=\"generateButton\" type=\"button\">초안 생성</button>",
    "          <button id=\"refreshButton\" type=\"button\" class=\"ghost\">목록 새로고침</button>",
    "        </div>",
    "      </section>",
    "      <section class=\"grid\">",
    "        <article class=\"panel\">",
    "          <h2>최근 초안</h2>",
    "          <div id=\"listRoot\" class=\"list-root\"></div>",
    "        </article>",
    "        <article class=\"panel\">",
    "          <h2>선택된 초안</h2>",
    "          <div id=\"detailRoot\" class=\"detail-root\"></div>",
    "        </article>",
    "      </section>",
    "    </main>",
    "    <script type=\"module\" src=\"/app.js\"></script>",
    "  </body>",
    "</html>",
  ].join("\n");
}

function renderFrontendApp(title: string, finalDecision: PMFinalDecision, frontendSpec: FrontendSpec): string {
  return [
    `const projectTitle = ${literal(title)};`,
    `const defaultScope = ${literalArray(finalDecision.mvpScope)};`,
    `const usabilityNotes = ${literalArray(frontendSpec.usabilityChecklist)};`,
    "",
    "const requestInput = document.getElementById(\"requestInput\");",
    "const generateButton = document.getElementById(\"generateButton\");",
    "const refreshButton = document.getElementById(\"refreshButton\");",
    "const listRoot = document.getElementById(\"listRoot\");",
    "const detailRoot = document.getElementById(\"detailRoot\");",
    "",
    "let drafts = [];",
    "",
    "generateButton.addEventListener(\"click\", async () => {",
    "  const request = requestInput.value.trim();",
    "  if (request.length < 10) {",
    "    requestInput.focus();",
    "    return;",
    "  }",
    "",
    "  generateButton.disabled = true;",
    "  try {",
    "    await fetch(\"/api/projects\", {",
    "      method: \"POST\",",
    "      headers: { \"Content-Type\": \"application/json\" },",
    "      body: JSON.stringify({ request }),",
    "    });",
    "    requestInput.value = \"\";",
    "    await loadDrafts();",
    "  } finally {",
    "    generateButton.disabled = false;",
    "  }",
    "});",
    "",
    "refreshButton.addEventListener(\"click\", () => {",
    "  void loadDrafts();",
    "});",
    "",
    "async function loadDrafts() {",
    "  const response = await fetch(\"/api/projects\");",
    "  const payload = await response.json();",
    "  drafts = payload.items ?? [];",
    "  renderList();",
    "  renderDetail(drafts[0]);",
    "}",
    "",
    "function renderList() {",
    "  if (drafts.length === 0) {",
    "    listRoot.innerHTML = `<div class=\"empty\">${escapeHtml(projectTitle)} 기준으로 아직 생성된 초안이 없습니다.</div>`;",
    "    return;",
    "  }",
    "",
    "  listRoot.innerHTML = drafts",
    "    .map((draft) => `",
    "      <button class=\"draft-card\" data-id=\"${draft.id}\">",
    "        <span class=\"draft-title\">${escapeHtml(draft.title)}</span>",
    "        <span class=\"draft-meta\">${new Date(draft.updatedAt).toLocaleString(\"ko-KR\")}</span>",
    "      </button>`)",
    "    .join(\"\");",
    "",
    "  for (const button of listRoot.querySelectorAll(\"[data-id]\")) {",
    "    button.addEventListener(\"click\", () => {",
    "      const selected = drafts.find((draft) => draft.id === button.dataset.id);",
    "      renderDetail(selected);",
    "    });",
    "  }",
    "}",
    "",
    "function renderDetail(draft) {",
    "  if (!draft) {",
    "    detailRoot.innerHTML = `<div class=\"empty\">생성 결과가 여기에 표시됩니다.</div>`;",
    "    return;",
    "  }",
    "",
    "  detailRoot.innerHTML = `",
    "    <h3>${escapeHtml(draft.title)}</h3>",
    "    <p class=\"summary\">${escapeHtml(draft.summary)}</p>",
    "    <div class=\"section\">",
    "      <h4>MVP 범위</h4>",
    "      <ul>${draft.scope.map((item) => `<li>${escapeHtml(item)}</li>`).join(\"\")}</ul>",
    "    </div>",
    "    <div class=\"section\">",
    "      <h4>기능 후보</h4>",
    "      <ul>${draft.features.map((item) => `<li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.reason)}</span></li>`).join(\"\")}</ul>",
    "    </div>",
    "    <div class=\"section\">",
    "      <h4>검토 메모</h4>",
    "      <ul>${draft.reviewNotes.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></li>`).join(\"\")}</ul>",
    "    </div>",
    "    <div class=\"section\">",
    "      <h4>프론트엔드 체크포인트</h4>",
    "      <ul>${usabilityNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join(\"\")}</ul>",
    "    </div>",
    "    <div class=\"section\">",
    "      <h4>기본 범위</h4>",
    "      <ul>${defaultScope.map((item) => `<li>${escapeHtml(item)}</li>`).join(\"\")}</ul>",
    "    </div>`;",
    "}",
    "",
    "function escapeHtml(value) {",
    "  return String(value)",
    "    .replaceAll(\"&\", \"&amp;\")",
    "    .replaceAll(\"<\", \"&lt;\")",
    "    .replaceAll(\">\", \"&gt;\");",
    "}",
    "",
    "void loadDrafts();",
  ].join("\n");
}

function renderFrontendStyles(): string {
  return [
    ":root {",
    "  --bg: #f6f0e8;",
    "  --panel: rgba(255, 252, 247, 0.88);",
    "  --ink: #1f2421;",
    "  --muted: #5c6660;",
    "  --line: rgba(31, 36, 33, 0.12);",
    "  --accent: #ca5a1f;",
    "}",
    "",
    "* { box-sizing: border-box; }",
    "body {",
    "  margin: 0;",
    "  font-family: \"Space Grotesk\", sans-serif;",
    "  color: var(--ink);",
    "  background: radial-gradient(circle at top left, rgba(18, 120, 132, 0.16), transparent 32%), var(--bg);",
    "}",
    ".shell { width: min(1100px, calc(100vw - 2rem)); margin: 0 auto; padding: 2rem 0 3rem; }",
    ".hero h1 { margin: 0.4rem 0 0.8rem; font-size: clamp(2.1rem, 5vw, 4rem); line-height: 0.95; }",
    ".eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); font-size: 0.75rem; }",
    ".hero-copy { max-width: 60ch; line-height: 1.7; color: var(--muted); }",
    ".composer, .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 24px; box-shadow: 0 18px 40px rgba(31, 36, 33, 0.06); }",
    ".composer { padding: 1rem; margin-top: 1.2rem; }",
    "textarea { width: 100%; min-height: 180px; border-radius: 20px; border: 1px solid var(--line); padding: 1rem; font: inherit; background: rgba(255,255,255,0.82); }",
    ".actions { display: flex; gap: 0.75rem; margin-top: 0.9rem; }",
    "button { font: inherit; border: none; cursor: pointer; border-radius: 999px; padding: 0.88rem 1.1rem; background: var(--accent); color: white; }",
    "button.ghost { background: white; color: var(--ink); border: 1px solid var(--line); }",
    ".grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 1rem; margin-top: 1rem; }",
    ".panel { padding: 1rem; min-height: 420px; }",
    ".list-root { display: flex; flex-direction: column; gap: 0.65rem; }",
    ".draft-card { width: 100%; text-align: left; background: white; color: var(--ink); border: 1px solid var(--line); display: grid; gap: 0.2rem; }",
    ".draft-title { font-weight: 700; }",
    ".draft-meta { font-size: 0.82rem; color: var(--muted); }",
    ".detail-root .summary { line-height: 1.65; color: var(--muted); }",
    ".section + .section { margin-top: 1rem; }",
    ".section h4 { margin: 0 0 0.4rem; }",
    ".section ul { margin: 0; padding-left: 1.2rem; line-height: 1.7; }",
    ".section li span { display: block; color: var(--muted); }",
    ".empty { border: 1px dashed var(--line); border-radius: 18px; padding: 1rem; color: var(--muted); }",
    "@media (max-width: 840px) { .grid { grid-template-columns: 1fr; } }",
  ].join("\n");
}

function renderEnvExample(): string {
  return [
    "PORT=4040",
    "NODE_ENV=development",
  ].join("\n");
}

function renderDockerfile(): string {
  return [
    "FROM node:22-alpine",
    "WORKDIR /app",
    "COPY package.json tsconfig.json ./",
    "COPY public ./public",
    "COPY src ./src",
    "RUN npm install",
    "EXPOSE 4040",
    "CMD [\"npm\", \"run\", \"dev\"]",
  ].join("\n");
}

function renderComposeYaml(): string {
  return [
    "services:",
    "  app:",
    "    build: .",
    "    env_file:",
    "      - .env.example",
    "    ports:",
    "      - \"4040:4040\"",
    "    restart: unless-stopped",
  ].join("\n");
}

function renderOpsReadme(infraSpec: InfraSpec): string {
  return [
    "# 운영 메모",
    "",
    "## 운영 체크리스트",
    ...infraSpec.operationsChecklist.map((item) => `- ${item}`),
    "",
    "## 구현 단계",
    ...infraSpec.implementationSteps.map((item) => `- ${item}`),
  ].join("\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function literal(value: string): string {
  return JSON.stringify(value);
}

function literalArray(values: string[]): string {
  return JSON.stringify(values, null, 2);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
