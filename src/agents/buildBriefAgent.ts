import { OllamaClient } from "../llm/ollamaClient.js";
import { buildBuildBriefPrompt } from "../prompts/buildBrief.js";
import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  ImplementationPlan,
  InfraSpec,
  PMFinalDecision,
} from "../types/contracts.js";
import { buildBriefSchema, type BuildBrief } from "../types/generation.js";

export async function generateBuildBrief(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
  implementationPlan: ImplementationPlan;
}): Promise<BuildBrief> {
  const prompt = buildBuildBriefPrompt(args);

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: buildBriefSchema,
      temperature: 0.1,
      numPredict: 900,
      maxRetries: 5,
    });
  } catch {
    return buildFallbackBuildBrief(args);
  }
}

function buildFallbackBuildBrief(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
  implementationPlan: ImplementationPlan;
}): BuildBrief {
  const appName = detectAppName(args.userRequest);
  const appType = detectAppType(args.userRequest, args.frontendSpec, args.backendSpec);

  return {
    appName,
    appType,
    primaryGoal: args.finalDecision.finalDecision,
    targetUsers: takeUnique([
      "end users",
      "operators",
      ...extractCandidateLabels(args.userRequest),
    ]).slice(0, 4),
    experiencePrinciples: takeUnique([
      ...args.frontendSpec.usabilityChecklist,
      "Keep the first-run path obvious and friction-light.",
      "Prefer visible outcomes over hidden workflow complexity.",
      "Make the generated output understandable without extra explanation.",
    ]).slice(0, 6),
    keyFeatures: takeUnique([
      ...args.finalDecision.mvpScope,
      ...args.aiFeaturesSpec.features,
      ...args.backendSpec.apiDesign,
    ]).slice(0, 8),
    screens: takeUnique([
      ...args.frontendSpec.screens,
      "Dashboard",
      "Detail View",
    ]).slice(0, 8),
    entities: takeUnique([
      ...args.backendSpec.dataModel,
      "AppState",
      "UserAction",
    ]).slice(0, 8),
    apiEndpoints: args.backendSpec.apiDesign.slice(0, 10),
    stack: detectStack(appType),
    fileLayout: detectFileLayout(appType),
    acceptanceChecks: takeUnique([
      ...args.implementationPlan.validationChecklist,
      ...args.finalDecision.deliveryPlan,
    ]).slice(0, 6),
    notes: takeUnique([
      ...args.infraSpec.operationsChecklist,
      ...args.aiFeaturesSpec.guardrails,
    ]).slice(0, 6),
  };
}

function detectAppName(userRequest: string): string {
  const namedPatterns = [
    /\bname\s+is\s+([A-Za-z][A-Za-z0-9-]{1,30})/i,
    /\bcalled\s+([A-Za-z][A-Za-z0-9-]{1,30})/i,
    /\bservice\s+name\s+([A-Za-z][A-Za-z0-9-]{1,30})/i,
  ];

  for (const pattern of namedPatterns) {
    const matched = userRequest.match(pattern);
    if (matched?.[1]) {
      return matched[1];
    }
  }

  const latinTokens = userRequest.match(/[A-Za-z][A-Za-z0-9-]{2,30}/g) ?? [];
  const meaningfulToken = latinTokens.find((token) => !isReservedNameToken(token));
  return meaningfulToken ?? "multi-agent-app";
}

function isReservedNameToken(token: string): boolean {
  const lower = token.toLowerCase();
  return ["api", "app", "web", "mobile", "mvp", "ui", "ux", "ai", "saas"].includes(lower);
}

function detectAppType(userRequest: string, frontendSpec: FrontendSpec, backendSpec: BackendSpec): BuildBrief["appType"] {
  const lower = userRequest.toLowerCase();
  if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android") || lower.includes("모바일")) {
    return backendSpec.apiDesign.length > 0 ? "fullstack-app" : "mobile-web-app";
  }
  if (lower.includes("api") && frontendSpec.screens.length === 0) {
    return "api";
  }
  if (frontendSpec.screens.length > 0 && backendSpec.apiDesign.length > 0) {
    return "fullstack-app";
  }
  if (backendSpec.apiDesign.length > 0) {
    return "api";
  }
  return "web-app";
}

function detectStack(appType: BuildBrief["appType"]): string[] {
  if (appType === "api") {
    return ["Node.js", "TypeScript", "built-in HTTP server"];
  }
  if (appType === "mobile-web-app") {
    return ["Node.js", "TypeScript", "vanilla mobile web UI"];
  }
  if (appType === "web-app") {
    return ["Node.js", "TypeScript", "vanilla web UI"];
  }
  return ["Node.js", "TypeScript", "fullstack web starter"];
}

function detectFileLayout(appType: BuildBrief["appType"]): string[] {
  const common = [
    "package.json",
    "tsconfig.json",
    "src/server.ts",
    "src/shared/contracts.ts",
    "src/lib/domain.ts",
    "ops/README.md",
  ];

  if (appType === "api") {
    return common;
  }

  return [...common, "public/index.html", "public/app.js", "public/styles.css"];
}

function extractCandidateLabels(userRequest: string): string[] {
  return userRequest
    .split(/[,\.\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3)
    .slice(0, 3);
}

function takeUnique(items: string[]): string[] {
  return items.filter((item, index) => item.trim().length > 0 && items.indexOf(item) === index);
}
