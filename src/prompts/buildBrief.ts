import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  ImplementationPlan,
  InfraSpec,
  PMFinalDecision,
  TestSpec,
} from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildBuildBriefPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
  testSpec: TestSpec;
  implementationPlan: ImplementationPlan;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "implementation",
    objective: "토론과 명세 결과를 코드 생성기가 바로 사용할 수 있는 build brief로 정리한다.",
    responsibilities: [
      "앱 이름, 앱 유형, 핵심 목표, 주요 기능, 화면, 엔티티, API, 스택, 파일 배치를 고정한다.",
      "backend, frontend, AI, infra, test가 각각 직접 파일을 생성할 수 있을 만큼 구체적으로 쓴다.",
      "추상적인 기획 언어보다 바로 구현 가능한 구조를 우선한다.",
      "sharedContracts에 역할 간 연결 계약을 반드시 명시한다: API 엔드포인트(백엔드→프론트), 공유 함수(AI→프론트/백엔드), 이벤트(프론트↔백엔드). 각 항목에 owner, consumers, payload 형태를 적는다.",
      "sharedContracts가 없으면 에이전트들이 서로 다른 인터페이스를 만들어 연결이 깨진다. 이것이 가장 중요한 항목이다.",
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
        title: "Test Spec",
        lines: [args.testSpec.overview, ...args.testSpec.testStrategy.map((item) => `- ${item}`)],
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
        '  "fileLayout": ["package.json", "src/server.ts", "public/index.html", "tests/bootstrap.test.mjs"],',
        '  "acceptanceChecks": ["check 1", "check 2", "check 3"],',
        '  "sharedContracts": [',
        '    {',
        '      "kind": "api-endpoint",',
        '      "signature": "GET /api/bootstrap",',
        '      "owner": "backend",',
        '      "consumers": ["frontend"],',
        '      "payload": "{ walks: WalkRequest[], profiles: WalkerProfile[] }"',
        '    },',
        '    {',
        '      "kind": "shared-function",',
        '      "signature": "buildInsightCards(data: AnalysisResult): InsightCard[]",',
        '      "owner": "ai",',
        '      "consumers": ["frontend", "backend"],',
        '      "payload": "InsightCard { title: string; body: string; score: number }"',
        '    },',
        '    {',
        '      "kind": "event",',
        '      "signature": "walk:status-changed",',
        '      "owner": "backend",',
        '      "consumers": ["frontend"],',
        '      "payload": "{ walkId: string; status: string }"',
        '    }',
        '  ],',
        '  "notes": ["note 1", "note 2"]',
      ],
      constraints: [
        "appType must be one of web-app, mobile-web-app, api, or fullstack-app.",
        "fileLayout must use real relative file paths.",
        "Keep the brief aligned with the PM final decision and all role specs.",
        "Choose a stack that this repository can realistically generate, run, and test today.",
      ],
    },
  });
}
