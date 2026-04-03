import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  ImplementationPlan,
  InfraSpec,
  PMFinalDecision,
} from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildBuildBriefPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
  implementationPlan: ImplementationPlan;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "implementation",
    objective:
      "Convert the discussion result into a concrete build brief that later agents can use to generate code without guessing.",
    responsibilities: [
      "Define the app name, app type, core goal, key features, screens, entities, APIs, stack, and target file layout.",
      "Make the brief concrete enough that backend, frontend, AI, and infra can each generate files directly.",
      "Prefer implementation-ready structure over abstract planning language.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      {
        title: "PM Final Decision",
        lines: [args.finalDecision.finalDecision, ...args.finalDecision.mvpScope.map((item) => `- ${item}`)],
      },
      {
        title: "Backend Spec",
        lines: [args.backendSpec.overview, ...args.backendSpec.apiDesign.map((item) => `- ${item}`)],
      },
      {
        title: "Frontend Spec",
        lines: [args.frontendSpec.overview, ...args.frontendSpec.screens.map((item) => `- ${item}`)],
      },
      {
        title: "AI Spec",
        lines: [args.aiFeaturesSpec.overview, ...args.aiFeaturesSpec.features.map((item) => `- ${item}`)],
      },
      {
        title: "Infra Spec",
        lines: [args.infraSpec.overview, ...args.infraSpec.deploymentTopology.map((item) => `- ${item}`)],
      },
      {
        title: "Implementation Plan",
        lines: [args.implementationPlan.overview, ...args.implementationPlan.milestones.map((item) => `- ${item}`)],
      },
    ],
    contract: {
      schemaLines: [
        '  "appName": "TrailPals",',
        '  "appType": "fullstack-app",',
        '  "primaryGoal": "Help neighbors coordinate dog walking schedules",',
        '  "targetUsers": ["dog owners", "walk coordinators"],',
        '  "experiencePrinciples": ["fast first-run setup", "clear next action", "mobile-friendly flow"],',
        '  "keyFeatures": ["feature 1", "feature 2", "feature 3", "feature 4"],',
        '  "screens": ["home", "detail"],',
        '  "entities": ["WalkRequest", "WalkerProfile"],',
        '  "apiEndpoints": ["GET /api/example", "POST /api/example"],',
        '  "stack": ["Node.js", "TypeScript", "vanilla web"],',
        '  "fileLayout": ["package.json", "src/server.ts", "public/index.html"],',
        '  "acceptanceChecks": ["check 1", "check 2", "check 3"],',
        '  "notes": ["note 1", "note 2"]',
      ],
      constraints: [
        "appType must be one of web-app, mobile-web-app, api, or fullstack-app.",
        "fileLayout must use real relative file paths.",
        "Keep the brief aligned with the PM final decision and the role specs.",
        "Choose a stack that this repository can realistically generate and run today.",
      ],
    },
  });
}
