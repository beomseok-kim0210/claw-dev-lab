import type { AgentRole, ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import type { BuildBrief, GeneratedCodeBundle } from "../types/generation.js";

type CodingRole = Exclude<AgentRole, "pm">;

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
      summary: "Created a stable backend starter bundle with a static asset server and bootstrap API.",
      files: [
        {
          path: "package.json",
          purpose: "Node.js scripts and zero-runtime-dependency development setup",
          content: renderPackageJson(args.buildBrief.appName),
        },
        {
          path: "tsconfig.json",
          purpose: "TypeScript build configuration",
          content: renderTsconfig(),
        },
        {
          path: "src/shared/contracts.ts",
          purpose: "Shared bootstrap payload and app constants",
          content: renderContracts(args.buildBrief),
        },
        {
          path: "src/server.ts",
          purpose: "HTTP server that serves static files and bootstrap data",
          content: renderServer(),
        },
      ],
      validation: [
        "npm run build must succeed without adding third-party runtime dependencies.",
        "GET /api/health and GET /api/bootstrap must both return 200.",
      ],
    };
  }

  if (args.role === "frontend") {
    return {
      role: "frontend",
      summary: "Created a responsive web UI that renders whatever the build brief describes.",
      files: [
        {
          path: "public/index.html",
          purpose: "App shell and semantic sections for generated content",
          content: renderIndexHtml(args.buildBrief),
        },
        {
          path: "public/app.js",
          purpose: "Bootstrap fetch and DOM rendering logic",
          content: renderAppJs(),
        },
        {
          path: "public/styles.css",
          purpose: "Responsive layout and visual system",
          content: renderStyles(),
        },
      ],
      validation: [
        "The page must render on mobile and desktop without layout collapse.",
        "The UI must render bootstrap data without placeholder text.",
      ],
    };
  }

  if (args.role === "ai") {
    return {
      role: "ai",
      summary: "Created domain insight helpers so the generated app can explain the request back to the user.",
      files: [
        {
          path: "src/lib/domain.ts",
          purpose: "Domain-specific insight cards derived from the build brief",
          content: renderDomain(args.buildBrief),
        },
      ],
      validation: [
        "Insight cards must summarize goals, users, and differentiators from the build brief.",
        "The generated insights must stay specific to the request and avoid generic filler.",
      ],
    };
  }

  if (args.role === "test") {
    return {
      role: "test",
      summary: "Created deterministic smoke tests and contract checks for the generated starter.",
      files: [
        {
          path: "tests/bootstrap.test.mjs",
          purpose: "Starts the built server and verifies the health and bootstrap endpoints",
          content: renderBootstrapTest(),
        },
        {
          path: "tests/contracts.test.mjs",
          purpose: "Checks that the bootstrap payload carries the expected contract keys",
          content: renderContractsTest(),
        },
      ],
      validation: [
        "npm test must pass after npm run build completes.",
        "The generated tests must fail clearly when health or bootstrap payloads drift.",
      ],
    };
  }

  return {
    role: "infra",
    summary: "Created run-time environment files for local execution and containerization.",
    files: [
      {
        path: ".env.example",
        purpose: "Default local environment values",
        content: "PORT=4040\nNODE_ENV=development\n",
      },
      {
        path: "Dockerfile",
        purpose: "Simple development-friendly container definition",
        content: [
          "FROM node:22-alpine",
          "WORKDIR /app",
          "COPY package.json tsconfig.json ./",
          "RUN npm install",
          "COPY public ./public",
          "COPY src ./src",
          "EXPOSE 4040",
          'CMD ["npm", "run", "dev"]',
        ].join("\n"),
      },
      {
        path: "ops/README.md",
        purpose: "Runbook for local execution and smoke checks",
        content: renderOpsReadme(args.buildBrief),
      },
    ],
    validation: [
      "Local setup must be a straight path: npm install, npm run build, npm run dev.",
      "Container instructions must match the local file layout.",
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
        test: "npm run build && node --test tests/*.test.mjs",
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
    `export const ACCEPTANCE_CHECKS = ${JSON.stringify(buildBrief.acceptanceChecks, null, 2)};`,
    `export const NOTES = ${JSON.stringify(buildBrief.notes, null, 2)};`,
    "",
    "export type InsightCard = {",
    "  title: string;",
    "  summary: string;",
    "  bullets: string[];",
    "};",
    "",
    "export type BootstrapPayload = {",
    "  appName: string;",
    "  primaryGoal: string;",
    "  appType: string;",
    "  targetUsers: string[];",
    "  experiencePrinciples: string[];",
    "  features: string[];",
    "  screens: string[];",
    "  entities: string[];",
    "  apiEndpoints: string[];",
    "  acceptanceChecks: string[];",
    "  notes: string[];",
    "  insightCards: InsightCard[];",
    "};",
  ].join("\n");
}

function renderServer(): string {
  return [
    "import { createReadStream } from \"node:fs\";",
    "import { stat } from \"node:fs/promises\";",
    "import { createServer } from \"node:http\";",
    "import path from \"node:path\";",
    "",
    "import { buildInsightCards } from \"./lib/domain.js\";",
    "import {",
    "  ACCEPTANCE_CHECKS,",
    "  API_ENDPOINTS,",
    "  APP_NAME,",
    "  APP_TITLE,",
    "  APP_TYPE,",
    "  ENTITIES,",
    "  EXPERIENCE_PRINCIPLES,",
    "  FEATURES,",
    "  NOTES,",
    "  SCREENS,",
    "  TARGET_USERS,",
    "  type BootstrapPayload,",
    "} from \"./shared/contracts.js\";",
    "",
    "const publicRoot = path.resolve(process.cwd(), \"public\");",
    "const port = Number(process.env.PORT ?? 4040);",
    "",
    "const server = createServer(async (req, res) => {",
    "  const url = new URL(req.url ?? \"/\", `http://${req.headers.host ?? \"127.0.0.1\"}`);",
    "  if ((req.method ?? \"GET\") === \"GET\" && url.pathname === \"/api/health\") {",
    "    return sendJson(res, 200, { ok: true, appName: APP_NAME, appType: APP_TYPE });",
    "  }",
    "  if ((req.method ?? \"GET\") === \"GET\" && url.pathname === \"/api/bootstrap\") {",
    "    const payload: BootstrapPayload = {",
    "      appName: APP_NAME,",
    "      primaryGoal: APP_TITLE,",
    "      appType: APP_TYPE,",
    "      targetUsers: TARGET_USERS,",
    "      experiencePrinciples: EXPERIENCE_PRINCIPLES,",
    "      features: FEATURES,",
    "      screens: SCREENS,",
    "      entities: ENTITIES,",
    "      apiEndpoints: API_ENDPOINTS,",
    "      acceptanceChecks: ACCEPTANCE_CHECKS,",
    "      notes: NOTES,",
    "      insightCards: buildInsightCards(),",
    "    };",
    "    return sendJson(res, 200, payload);",
    "  }",
    "  return serveStatic(url.pathname, res);",
    "});",
    "",
    "server.listen(port, () => {",
    "  console.log(`app is running at http://127.0.0.1:${port}`);",
    "});",
    "",
    "async function serveStatic(pathname: string, res: import(\"node:http\").ServerResponse) {",
    "  const relativePath = pathname === \"/\" ? \"/index.html\" : pathname;",
    "  const filePath = path.resolve(publicRoot, `.${relativePath}`);",
    "  try {",
    "    const fileStat = await stat(filePath);",
    "    if (!fileStat.isFile()) {",
    "      return sendJson(res, 404, { error: \"Not found\" });",
    "    }",
    "    res.writeHead(200, { \"Content-Type\": contentTypeFor(filePath) });",
    "    createReadStream(filePath).pipe(res);",
    "  } catch {",
    "    sendJson(res, 404, { error: \"Not found\" });",
    "  }",
    "}",
    "",
    "function sendJson(res: import(\"node:http\").ServerResponse, statusCode: number, body: unknown) {",
    "  res.writeHead(statusCode, { \"Content-Type\": \"application/json; charset=utf-8\" });",
    "  res.end(JSON.stringify(body));",
    "}",
    "",
    "function contentTypeFor(filePath: string) {",
    "  if (filePath.endsWith(\".html\")) return \"text/html; charset=utf-8\";",
    "  if (filePath.endsWith(\".js\")) return \"text/javascript; charset=utf-8\";",
    "  if (filePath.endsWith(\".css\")) return \"text/css; charset=utf-8\";",
    "  return \"text/plain; charset=utf-8\";",
    "}",
  ].join("\n");
}

function renderIndexHtml(buildBrief: BuildBrief): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"utf-8\" />",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `    <title>${escapeHtml(buildBrief.appName)}</title>`,
    "    <link rel=\"stylesheet\" href=\"/styles.css\" />",
    "  </head>",
    "  <body>",
    "    <main class=\"shell\">",
    "      <section class=\"hero panel\">",
    `        <p class=\"eyebrow\">${escapeHtml(buildBrief.appName)}</p>`,
    "        <h1 id=\"goal\"></h1>",
    "        <p id=\"appType\" class=\"hero-copy\"></p>",
    "      </section>",
    "      <section class=\"grid two-up\">",
    "        <article class=\"panel\"><h2>Target Users</h2><ul id=\"userList\"></ul></article>",
    "        <article class=\"panel\"><h2>Experience Principles</h2><ul id=\"principleList\"></ul></article>",
    "        <article class=\"panel\"><h2>Key Features</h2><ul id=\"featureList\"></ul></article>",
    "        <article class=\"panel\"><h2>Screens</h2><ul id=\"screenList\"></ul></article>",
    "        <article class=\"panel\"><h2>Entities</h2><ul id=\"entityList\"></ul></article>",
    "        <article class=\"panel\"><h2>API Endpoints</h2><ul id=\"apiList\"></ul></article>",
    "      </section>",
    "      <section class=\"panel\">",
    "        <h2>Generated Insight Cards</h2>",
    "        <div id=\"insightList\" class=\"insight-grid\"></div>",
    "      </section>",
    "      <section class=\"grid two-up\">",
    "        <article class=\"panel\"><h2>Acceptance Checks</h2><ul id=\"checkList\"></ul></article>",
    "        <article class=\"panel\"><h2>Notes</h2><ul id=\"noteList\"></ul></article>",
    "      </section>",
    "    </main>",
    "    <script type=\"module\" src=\"/app.js\"></script>",
    "  </body>",
    "</html>",
  ].join("\n");
}

function renderAppJs(): string {
  return [
    "const byId = (id) => document.getElementById(id);",
    "",
    "async function main() {",
    "  const response = await fetch(\"/api/bootstrap\");",
    "  const payload = await response.json();",
    "",
    "  byId(\"goal\").textContent = payload.primaryGoal;",
    "  byId(\"appType\").textContent = `${payload.appName} is currently generated as a ${payload.appType}.`;",
    "  renderList(\"userList\", payload.targetUsers);",
    "  renderList(\"principleList\", payload.experiencePrinciples);",
    "  renderList(\"featureList\", payload.features);",
    "  renderList(\"screenList\", payload.screens);",
    "  renderList(\"entityList\", payload.entities);",
    "  renderList(\"apiList\", payload.apiEndpoints.length > 0 ? payload.apiEndpoints : [\"No API endpoints defined yet.\"]);",
    "  renderList(\"checkList\", payload.acceptanceChecks);",
    "  renderList(\"noteList\", payload.notes);",
    "  renderInsightCards(payload.insightCards);",
    "}",
    "",
    "function renderList(id, items) {",
    "  const node = byId(id);",
    "  node.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join(\"\");",
    "}",
    "",
    "function renderInsightCards(cards) {",
    "  const node = byId(\"insightList\");",
    "  node.innerHTML = cards",
    "    .map((card) => `",
    "      <article class=\"insight-card\">",
    "        <h3>${escapeHtml(card.title)}</h3>",
    "        <p>${escapeHtml(card.summary)}</p>",
    "        <ul>${card.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join(\"\")}</ul>",
    "      </article>",
    "    `)",
    "    .join(\"\");",
    "}",
    "",
    "function escapeHtml(value) {",
    "  return String(value)",
    "    .replaceAll(\"&\", \"&amp;\")",
    "    .replaceAll(\"<\", \"&lt;\")",
    "    .replaceAll(\">\", \"&gt;\")",
    "    .replaceAll('\"', \"&quot;\");",
    "}",
    "",
    "void main();",
  ].join("\n");
}

function renderStyles(): string {
  return [
    ":root {",
    "  --bg: #f4efe6;",
    "  --surface: rgba(255, 250, 244, 0.92);",
    "  --ink: #1f2421;",
    "  --muted: #5f6662;",
    "  --line: rgba(31, 36, 33, 0.12);",
    "  --accent: #0d6d66;",
    "  --accent-soft: rgba(13, 109, 102, 0.12);",
    "}",
    "* { box-sizing: border-box; }",
    "body {",
    "  margin: 0;",
    "  background:",
    "    radial-gradient(circle at top, rgba(13, 109, 102, 0.16), transparent 28%),",
    "    linear-gradient(180deg, #f7f3eb 0%, #efe4d5 100%);",
    "  color: var(--ink);",
    "  font-family: \"Segoe UI\", \"Apple SD Gothic Neo\", \"Noto Sans KR\", sans-serif;",
    "}",
    ".shell { width: min(1080px, calc(100vw - 1.5rem)); margin: 0 auto; padding: 1rem 0 2rem; }",
    ".panel {",
    "  background: var(--surface);",
    "  border: 1px solid var(--line);",
    "  border-radius: 24px;",
    "  padding: 1rem;",
    "  box-shadow: 0 20px 40px rgba(31, 36, 33, 0.08);",
    "}",
    ".hero { padding: 1.25rem; }",
    ".eyebrow { margin: 0; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent); font-size: 0.78rem; }",
    ".hero h1 { margin: 0.5rem 0 0.75rem; font-size: clamp(2rem, 8vw, 4.2rem); line-height: 0.92; }",
    ".hero-copy { margin: 0; color: var(--muted); line-height: 1.7; }",
    ".grid { display: grid; gap: 1rem; margin-top: 1rem; }",
    ".two-up { grid-template-columns: repeat(1, minmax(0, 1fr)); }",
    ".panel h2 { margin: 0 0 0.75rem; font-size: 1.05rem; }",
    ".panel ul { margin: 0; padding-left: 1.15rem; line-height: 1.75; }",
    ".insight-grid { display: grid; gap: 0.9rem; }",
    ".insight-card { border: 1px solid var(--line); border-radius: 18px; padding: 1rem; background: linear-gradient(180deg, #ffffff, var(--accent-soft)); }",
    ".insight-card h3 { margin: 0 0 0.35rem; }",
    ".insight-card p { margin: 0 0 0.75rem; color: var(--muted); line-height: 1.6; }",
    ".insight-card ul { margin: 0; padding-left: 1.1rem; }",
    "@media (min-width: 760px) {",
    "  .shell { width: min(1200px, calc(100vw - 2rem)); padding-top: 1.5rem; }",
    "  .two-up { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    "  .insight-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }",
    "}",
    "@media (max-width: 759px) {",
    "  .shell { width: min(100vw - 1rem, 560px); }",
    "}",
  ].join("\n");
}

function renderDomain(buildBrief: BuildBrief): string {
  const cards = [
    {
      title: "Primary Goal",
      summary: buildBrief.primaryGoal,
      bullets: buildBrief.keyFeatures.slice(0, 3),
    },
    {
      title: "Who This Is For",
      summary: `The generated experience is aimed at ${buildBrief.targetUsers.join(", ")}.`,
      bullets: buildBrief.experiencePrinciples.slice(0, 3),
    },
    {
      title: "Execution Focus",
      summary: "The multi-agent pipeline should keep the first release narrow enough to ship.",
      bullets: buildBrief.acceptanceChecks.slice(0, 3),
    },
  ];

  return [
    "import type { InsightCard } from \"../shared/contracts.js\";",
    "",
    `const DOMAIN_INSIGHTS: InsightCard[] = ${JSON.stringify(cards, null, 2)};`,
    "",
    "export function buildInsightCards(): InsightCard[] {",
    "  return DOMAIN_INSIGHTS;",
    "}",
  ].join("\n");
}

function renderOpsReadme(buildBrief: BuildBrief): string {
  return [
    `# ${buildBrief.appName} Ops`,
    "",
    "## Local Run",
    "- npm install",
    "- npm run build",
    "- npm run dev",
    "",
    "## Smoke Checks",
    "- Open http://127.0.0.1:4040",
    "- Confirm /api/health returns app metadata",
    "- Confirm /api/bootstrap renders the generated brief",
    "- Run npm test and confirm both generated smoke tests pass",
    "",
    "## Acceptance Checks",
    ...buildBrief.acceptanceChecks.map((item) => `- ${item}`),
  ].join("\n");
}

function renderBootstrapTest(): string {
  return [
    "import assert from \"node:assert/strict\";",
    "import { spawn } from \"node:child_process\";",
    "import test from \"node:test\";",
    "",
    "const PORT = 4173;",
    "const BASE_URL = `http://127.0.0.1:${PORT}`;",
    "",
    "test(\"health and bootstrap endpoints respond\", async (t) => {",
    "  const server = spawn(process.execPath, [\"dist/server.js\"], {",
    "    env: { ...process.env, PORT: String(PORT) },",
    "    stdio: [\"ignore\", \"pipe\", \"pipe\"],",
    "  });",
    "",
    "  const stopServer = () => {",
    "    if (!server.killed) {",
    "      server.kill();",
    "    }",
    "  };",
    "",
    "  await t.test(\"wait for boot\", async () => {",
    "    await waitForServer(BASE_URL, 8000);",
    "  });",
    "",
    "  t.after(stopServer);",
    "",
    "  const healthResponse = await fetch(`${BASE_URL}/api/health`);",
    "  assert.equal(healthResponse.status, 200);",
    "  const health = await healthResponse.json();",
    "  assert.equal(health.ok, true);",
    "",
    "  const bootstrapResponse = await fetch(`${BASE_URL}/api/bootstrap`);",
    "  assert.equal(bootstrapResponse.status, 200);",
    "  const bootstrap = await bootstrapResponse.json();",
    "  assert.equal(typeof bootstrap.appName, \"string\");",
    "  assert.ok(Array.isArray(bootstrap.features));",
    "  assert.ok(Array.isArray(bootstrap.insightCards));",
    "});",
    "",
    "async function waitForServer(baseUrl, timeoutMs) {",
    "  const startedAt = Date.now();",
    "  while (Date.now() - startedAt < timeoutMs) {",
    "    try {",
    "      const response = await fetch(`${baseUrl}/api/health`);",
    "      if (response.ok) {",
    "        return;",
    "      }",
    "    } catch {}",
    "    await new Promise((resolve) => setTimeout(resolve, 200));",
    "  }",
    "  throw new Error(\"Server did not become ready in time.\");",
    "}",
  ].join("\n");
}

function renderContractsTest(): string {
  return [
    "import assert from \"node:assert/strict\";",
    "import test from \"node:test\";",
    "",
    "import {",
    "  ACCEPTANCE_CHECKS,",
    "  API_ENDPOINTS,",
    "  APP_NAME,",
    "  EXPERIENCE_PRINCIPLES,",
    "  FEATURES,",
    "  NOTES,",
    "  SCREENS,",
    "  TARGET_USERS,",
    "} from \"../dist/shared/contracts.js\";",
    "",
    "test(\"shared contract exports contain the required arrays\", () => {",
    "  assert.equal(typeof APP_NAME, \"string\");",
    "  assert.ok(Array.isArray(TARGET_USERS));",
    "  assert.ok(Array.isArray(EXPERIENCE_PRINCIPLES));",
    "  assert.ok(Array.isArray(FEATURES));",
    "  assert.ok(Array.isArray(SCREENS));",
    "  assert.ok(Array.isArray(API_ENDPOINTS));",
    "  assert.ok(Array.isArray(ACCEPTANCE_CHECKS));",
    "  assert.ok(Array.isArray(NOTES));",
    "});",
  ].join("\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
