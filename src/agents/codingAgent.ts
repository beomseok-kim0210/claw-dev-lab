import type { AgentRole, ChatMessage } from "../types/chat.js";
import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  ImplementationPlan,
  ImplementationReview,
  ImplementationUpdate,
  InfraSpec,
  TestSpec,
} from "../types/contracts.js";
import type { GeneratedArtifact } from "../types/orchestration.js";

type CodingRole = Exclude<AgentRole, "pm">;

export async function runImplementationUpdate(args: {
  client?: unknown;
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  task: ImplementationPlan["tasks"][number];
  targetFiles: string[];
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
  testSpec?: TestSpec;
}): Promise<ImplementationUpdate> {
  return {
    headline: `${roleTitle(args.role)} implementation start`,
    taskId: args.task.id,
    objective: args.task.goal,
    targetFiles: args.targetFiles,
    worklog: takeAtLeast(
      [
        `${roleTitle(args.role)} owns the files for ${args.task.title.toLowerCase()}.`,
        `The bundle is being generated directly from the assigned deliverables: ${args.task.deliverables.join(", ")}.`,
        `The request context is kept narrow: ${shrink(args.userRequest)}.`,
      ],
      2,
      "Add one more implementation note.",
    ),
    validation: takeAtLeast(
      [
        ...args.task.acceptanceCriteria.slice(0, 2),
        "Generated files must stay within the role boundary and avoid collisions with existing output.",
      ],
      2,
      "Add one more validation note.",
    ),
    references: takeReferences(args.messages),
  };
}

export async function runImplementationReview(args: {
  client?: unknown;
  role: CodingRole;
  userRequest?: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
  targetFiles: string[];
  generatedArtifacts: GeneratedArtifact[];
}): Promise<ImplementationReview> {
  const approvedAreas = buildApprovedAreas(args.role, args.generatedArtifacts);
  const findings = buildFindings(args.role, args.generatedArtifacts);
  const reactionType = deriveReactionType(findings);

  return {
    headline: `${roleTitle(args.role)} code review`,
    reactionType,
    targetMessageId: args.targetMessage.id,
    targetFiles: args.targetFiles,
    approvedAreas: takeAtLeast(
      approvedAreas.length > 0 ? approvedAreas : ["The generated file bundle is concrete and non-empty."],
      1,
      "Add one more approved area.",
    ).slice(0, 5),
    findings: takeAtLeast(
      findings.length > 0 ? findings : ["No blocking issue was found in the reviewed bundle."],
      1,
      "Add one more finding.",
    ).slice(0, 5),
    assessment: buildAssessment(args.role, args.generatedArtifacts, reactionType),
    adjustment: buildAdjustment(args.role, findings),
    references: takeReferences(args.messages),
  };
}

export function formatImplementationUpdate(update: ImplementationUpdate): string {
  return [
    `Title: ${update.headline}`,
    `Task: ${update.taskId}`,
    `Objective: ${update.objective}`,
    "Target Files:",
    ...update.targetFiles.map((item) => `- ${item}`),
    "Worklog:",
    ...update.worklog.map((item) => `- ${item}`),
    "Validation:",
    ...update.validation.map((item) => `- ${item}`),
    `References: ${update.references.join(", ")}`,
  ].join("\n");
}

export function formatImplementationReview(review: ImplementationReview): string {
  return [
    `Title: ${review.headline}`,
    "Message Type: code review",
    `Reaction: ${reactionLabel(review.reactionType)}`,
    `Target Message: ${review.targetMessageId}`,
    "Reviewed Files:",
    ...review.targetFiles.map((item) => `- ${item}`),
    "Approved Areas:",
    ...review.approvedAreas.map((item) => `- ${item}`),
    "Findings:",
    ...review.findings.map((item) => `- ${item}`),
    `Assessment: ${review.assessment}`,
    `Adjustment: ${review.adjustment}`,
    `References: ${review.references.join(", ")}`,
  ].join("\n");
}

function buildApprovedAreas(role: CodingRole, artifacts: GeneratedArtifact[]): string[] {
  const approved: string[] = [];

  if (artifacts.every((artifact) => artifact.content.trim().length > 0)) {
    approved.push("All reviewed files contain concrete content instead of empty stubs.");
  }

  if (!artifacts.some((artifact) => /todo|placeholder|fill me|lorem ipsum/i.test(artifact.content))) {
    approved.push("No placeholder markers were found in the reviewed code.");
  }

  if (role === "frontend") {
    if (hasContent(artifacts, "src/server.ts", "/api/bootstrap")) {
      approved.push("Backend exposes a bootstrap endpoint that the UI can consume immediately.");
    }
    if (hasContent(artifacts, "src/shared/contracts.ts", "BootstrapPayload")) {
      approved.push("The shared contract defines a bootstrap payload instead of leaving the response shape implicit.");
    }
  }

  if (role === "ai") {
    if (hasContent(artifacts, "public/app.js", 'fetch("/api/bootstrap")')) {
      approved.push("Frontend wiring already pulls a deterministic bootstrap payload from the server.");
    }
    if (hasContent(artifacts, "public/index.html", 'id="insightList"')) {
      approved.push("Frontend leaves a dedicated surface for insight-style content.");
    }
  }

  if (role === "infra") {
    if (hasContent(artifacts, "src/lib/domain.ts", "buildInsightCards")) {
      approved.push("The AI helper exports a deterministic function instead of hiding logic in anonymous code.");
    }
    if (!extractImportSpecifiers(findArtifactContent(artifacts, "src/lib/domain.ts")).some(isExternalImport)) {
      approved.push("The AI helper stays runtime-light and does not pull in extra external packages.");
    }
  }

  if (role === "test") {
    if (hasContent(artifacts, "src/server.ts", "/api/health")) {
      approved.push("Backend exposes a health endpoint that the smoke suite can probe immediately.");
    }
    if (hasContent(artifacts, "src/server.ts", "/api/bootstrap")) {
      approved.push("Backend exposes a bootstrap endpoint that a smoke test can verify end-to-end.");
    }
    if (hasContent(artifacts, "src/shared/contracts.ts", "BootstrapPayload")) {
      approved.push("Shared contracts define a bootstrap payload shape that can anchor contract tests.");
    }
  }

  if (role === "backend") {
    if (hasContent(artifacts, ".env.example", "PORT=")) {
      approved.push("Infra provides an explicit port default for local boot.");
    }
    if (hasContent(artifacts, "Dockerfile", "npm install")) {
      approved.push("The Dockerfile includes an install step that matches the generated package layout.");
    }
  }

  return unique(approved);
}

function buildFindings(role: CodingRole, artifacts: GeneratedArtifact[]): string[] {
  const findings: string[] = [];

  for (const artifact of artifacts) {
    if (/todo|placeholder|fill me|lorem ipsum/i.test(artifact.content)) {
      findings.push(`Blocking: ${artifact.filename} still contains placeholder text.`);
    }
  }

  for (const artifact of artifacts) {
    if (/\.(?:ts|tsx|mts|cts)$/u.test(artifact.filename)) {
      const imports = extractImportSpecifiers(artifact.content).filter(isRelativeImport);
      for (const specifier of imports) {
        if (!/\.(?:js|mjs|cjs)$/u.test(specifier)) {
          findings.push(`Follow-up: ${artifact.filename} imports ${specifier} without an explicit .js-style extension.`);
        }
      }
    }
  }

  if (role === "frontend") {
    if (!hasContent(artifacts, "src/server.ts", "/api/bootstrap")) {
      findings.push("Blocking: backend review could not find a /api/bootstrap route for the frontend bootstrap call.");
    }
    if (!hasContent(artifacts, "src/server.ts", "/api/health")) {
      findings.push("Follow-up: add a lightweight health endpoint so the generated app is easier to smoke test.");
    }
  }

  if (role === "ai") {
    if (!hasContent(artifacts, "public/app.js", 'fetch("/api/bootstrap")')) {
      findings.push("Blocking: frontend review could not find a bootstrap fetch in public/app.js.");
    }
    if (!hasContent(artifacts, "public/index.html", 'id="featureList"')) {
      findings.push("Follow-up: frontend HTML should expose a visible feature list so the generated brief is actually readable.");
    }
    if (!hasContent(artifacts, "public/styles.css", "@media")) {
      findings.push("Follow-up: frontend styles should include an explicit responsive rule for mobile and desktop behavior.");
    }
  }

  if (role === "infra") {
    if (!hasContent(artifacts, "src/lib/domain.ts", "export function buildInsightCards")) {
      findings.push("Blocking: the AI helper does not expose a stable buildInsightCards entry point.");
    }
    if (extractImportSpecifiers(findArtifactContent(artifacts, "src/lib/domain.ts")).some(isExternalImport)) {
      findings.push("Follow-up: keep the AI helper free of external runtime imports so the generated starter stays easy to run.");
    }
  }

  if (role === "backend") {
    if (!hasContent(artifacts, ".env.example", "PORT=")) {
      findings.push("Blocking: infra review could not find a PORT default in .env.example.");
    }
    if (!hasContent(artifacts, "Dockerfile", "COPY src ./src")) {
      findings.push("Follow-up: Dockerfile should copy the src directory so the container can actually run the app.");
    }
    if (!hasContent(artifacts, "ops/README.md", "npm run dev")) {
      findings.push("Follow-up: ops documentation should include a concrete local run command.");
    }
  }

  if (role === "test") {
    if (!artifacts.some((artifact) => artifact.filename.endsWith("tests/bootstrap.test.mjs"))) {
      findings.push("Blocking: test review could not find tests/bootstrap.test.mjs.");
    }
    if (!artifacts.some((artifact) => artifact.filename.endsWith("tests/contracts.test.mjs"))) {
      findings.push("Follow-up: add a contracts-focused test so payload shape regressions are caught.");
    }
    if (!hasContent(artifacts, "package.json", "\"test\"")) {
      findings.push("Follow-up: expose a test script in package.json so the generated suite is easy to run.");
    }
  }

  return unique(findings).slice(0, 5);
}

function buildAssessment(
  role: CodingRole,
  artifacts: GeneratedArtifact[],
  reactionType: ImplementationReview["reactionType"],
): string {
  return `${roleTitle(role)} reviewed ${artifacts.length} generated file(s) and classified the bundle as ${reactionType}.`;
}

function buildAdjustment(role: CodingRole, findings: string[]): string {
  const blockingFinding = findings.find((item) => item.startsWith("Blocking:"));
  if (blockingFinding) {
    return `${roleTitle(role)} wants the owner to address this first: ${blockingFinding.replace(/^Blocking:\s*/u, "")}`;
  }

  const followUpFinding = findings.find((item) => item.startsWith("Follow-up:"));
  if (followUpFinding) {
    return `${roleTitle(role)} wants a small revision next: ${followUpFinding.replace(/^Follow-up:\s*/u, "")}`;
  }

  return `${roleTitle(role)} sees no blocking issue and would move to the next coding step without forcing a rewrite.`;
}

function deriveReactionType(findings: string[]): ImplementationReview["reactionType"] {
  if (findings.some((item) => item.startsWith("Blocking:"))) {
    return "challenge";
  }
  if (findings.some((item) => item.startsWith("Follow-up:"))) {
    return "refine";
  }
  return "support";
}

function findArtifactContent(artifacts: GeneratedArtifact[], suffix: string): string {
  const artifact = artifacts.find((item) => item.filename.endsWith(suffix));
  return artifact?.content ?? "";
}

function hasContent(artifacts: GeneratedArtifact[], suffix: string, needle: string): boolean {
  return findArtifactContent(artifacts, suffix).includes(needle);
}

function extractImportSpecifiers(content: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        matches.push(specifier);
      }
    }
  }

  return matches;
}

function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function isExternalImport(specifier: string): boolean {
  return specifier.length > 0 && !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("node:");
}

function roleTitle(role: CodingRole): string {
  if (role === "backend") {
    return "Backend";
  }
  if (role === "frontend") {
    return "Frontend";
  }
  if (role === "infra") {
    return "Infra";
  }
  if (role === "test") {
    return "Test";
  }
  return "AI";
}

function reactionLabel(reactionType: ImplementationReview["reactionType"]): string {
  if (reactionType === "challenge") {
    return "challenge";
  }
  if (reactionType === "support") {
    return "support";
  }
  return "refine";
}

function takeReferences(messages: ChatMessage[]): string[] {
  const ids = messages
    .slice(-3)
    .map((message) => message.id)
    .filter((value, index, array) => array.indexOf(value) === index);

  return ids.length > 0 ? ids : ["msg-001"];
}

function takeAtLeast(items: string[], minimum: number, fallback: string): string[] {
  const filtered = unique(items).filter((item) => item.trim().length > 0).slice(0, 5);
  while (filtered.length < minimum) {
    filtered.push(fallback);
  }
  return filtered;
}

function unique(items: string[]): string[] {
  return items.filter((item, index) => item.trim().length > 0 && items.indexOf(item) === index);
}

function shrink(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}
