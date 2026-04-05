import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  ImplementationPlan,
  InfraSpec,
  PMFinalDecision,
  TestSpec,
} from "../types/contracts.js";
import type { BuildBrief } from "../types/generation.js";
import type { GeneratedArtifact } from "../types/orchestration.js";

type ArtifactInput = {
  filename: string;
  content: string;
};

type WriteArtifactsOptions = {
  onArtifactWritten?: (artifact: GeneratedArtifact, writtenArtifacts: GeneratedArtifact[]) => void | Promise<void>;
};

export async function writeExecutionArtifacts(args: {
  outputDir: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
  testSpec: TestSpec;
  implementationPlan: ImplementationPlan;
  buildBrief: BuildBrief;
}): Promise<GeneratedArtifact[]> {
  return writeArtifacts(args.outputDir, [
    {
      filename: "backend-spec.md",
      content: renderBackendSpecMarkdown(args.finalDecision, args.backendSpec),
    },
    {
      filename: "frontend-spec.md",
      content: renderFrontendSpecMarkdown(args.finalDecision, args.frontendSpec),
    },
    {
      filename: "ai-features.md",
      content: renderAIFeaturesMarkdown(args.finalDecision, args.aiFeaturesSpec),
    },
    {
      filename: "infra-spec.md",
      content: renderInfraSpecMarkdown(args.finalDecision, args.infraSpec),
    },
    {
      filename: "test-spec.md",
      content: renderTestSpecMarkdown(args.finalDecision, args.testSpec),
    },
    {
      filename: "implementation-plan.md",
      content: renderImplementationPlanMarkdown(args.finalDecision, args.implementationPlan),
    },
    {
      filename: "build-brief.md",
      content: renderBuildBriefMarkdown(args.buildBrief),
    },
  ]);
}

export async function writeArtifacts(
  outputDir: string,
  artifacts: ArtifactInput[],
  options?: WriteArtifactsOptions,
): Promise<GeneratedArtifact[]> {
  const writtenArtifacts: GeneratedArtifact[] = [];

  for (const artifact of artifacts) {
    const absolutePath = path.resolve(outputDir, artifact.filename);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, artifact.content, "utf8");
    writtenArtifacts.push({
      filename: artifact.filename,
      absolutePath,
      content: artifact.content,
    });
    const writtenArtifact = writtenArtifacts[writtenArtifacts.length - 1];
    if (writtenArtifact) {
      await options?.onArtifactWritten?.(writtenArtifact, [...writtenArtifacts]);
    }
  }

  return writtenArtifacts;
}

function renderBackendSpecMarkdown(finalDecision: PMFinalDecision, spec: BackendSpec): string {
  return [
    "# 백엔드 명세",
    "",
    "## PM 최종 방향",
    spec.overview,
    "",
    "### 최종 MVP 범위",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## API 설계",
    ...spec.apiDesign.map((item) => `- ${item}`),
    "",
    "## 데이터 모델",
    ...spec.dataModel.map((item) => `- ${item}`),
    "",
    "## 기술 제약",
    ...spec.constraints.map((item) => `- ${item}`),
    "",
    "## 구현 단계",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## 예시 코드",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderFrontendSpecMarkdown(finalDecision: PMFinalDecision, spec: FrontendSpec): string {
  return [
    "# 프론트엔드 명세",
    "",
    "## PM 최종 방향",
    spec.overview,
    "",
    "### 최종 MVP 범위",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## 화면 구성",
    ...spec.screens.map((item) => `- ${item}`),
    "",
    "## 컴포넌트 구조",
    ...spec.components.map((item) => `- ${item}`),
    "",
    "## 사용성 체크리스트",
    ...spec.usabilityChecklist.map((item) => `- ${item}`),
    "",
    "## 구현 단계",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## 예시 코드",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderAIFeaturesMarkdown(finalDecision: PMFinalDecision, spec: AIFeaturesSpec): string {
  return [
    "# AI 기능 명세",
    "",
    "## PM 최종 방향",
    spec.overview,
    "",
    "### 최종 MVP 범위",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## 제안된 AI 기능",
    ...spec.features.map((item) => `- ${item}`),
    "",
    "## 실현 가능성 메모",
    ...spec.feasibilityNotes.map((item) => `- ${item}`),
    "",
    "## 가드레일",
    ...spec.guardrails.map((item) => `- ${item}`),
    "",
    "## 구현 단계",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## 예시 코드",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderInfraSpecMarkdown(finalDecision: PMFinalDecision, spec: InfraSpec): string {
  return [
    "# 인프라 명세",
    "",
    "## PM 최종 방향",
    spec.overview,
    "",
    "### 최종 MVP 범위",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## 배포 토폴로지",
    ...spec.deploymentTopology.map((item) => `- ${item}`),
    "",
    "## 환경 구성",
    ...spec.environments.map((item) => `- ${item}`),
    "",
    "## 운영 체크리스트",
    ...spec.operationsChecklist.map((item) => `- ${item}`),
    "",
    "## 구현 단계",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## 예시 코드",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderTestSpecMarkdown(finalDecision: PMFinalDecision, spec: TestSpec): string {
  return [
    "# 테스트 명세",
    "",
    "## PM 최종 방향",
    spec.overview,
    "",
    "### 최종 MVP 범위",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## 테스트 전략",
    ...spec.testStrategy.map((item) => `- ${item}`),
    "",
    "## 핵심 시나리오",
    ...spec.testScenarios.map((item) => `- ${item}`),
    "",
    "## 품질 게이트",
    ...spec.qualityGates.map((item) => `- ${item}`),
    "",
    "## 구현 단계",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## 예시 코드",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderImplementationPlanMarkdown(finalDecision: PMFinalDecision, plan: ImplementationPlan): string {
  return [
    "# 구현 실행 계획",
    "",
    "## PM 최종 방향",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## 전체 개요",
    plan.overview,
    "",
    "## 마일스톤",
    ...plan.milestones.map((item) => `- ${item}`),
    "",
    "## 역할별 작업",
    ...plan.tasks.flatMap((task) => [
      `### ${task.id} - ${task.title}`,
      `- 담당: ${roleLabel(task.owner)}`,
      `- 목표: ${task.goal}`,
      ...task.deliverables.map((item) => `- 산출물: ${item}`),
      ...task.acceptanceCriteria.map((item) => `- 완료 기준: ${item}`),
      "",
    ]),
    "## 검증 체크리스트",
    ...plan.validationChecklist.map((item) => `- ${item}`),
    "",
    "## 구현 에이전트 시작 지시문",
    plan.kickoffPrompt,
  ].join("\n");
}

function renderBuildBriefMarkdown(buildBrief: BuildBrief): string {
  return [
    "# Build Brief",
    "",
    `- App Name: ${buildBrief.appName}`,
    `- App Type: ${buildBrief.appType}`,
    `- Primary Goal: ${buildBrief.primaryGoal}`,
    "",
    "## Target Users",
    ...buildBrief.targetUsers.map((item) => `- ${item}`),
    "",
    "## Experience Principles",
    ...buildBrief.experiencePrinciples.map((item) => `- ${item}`),
    "",
    "## Key Features",
    ...buildBrief.keyFeatures.map((item) => `- ${item}`),
    "",
    "## Screens",
    ...buildBrief.screens.map((item) => `- ${item}`),
    "",
    "## Entities",
    ...buildBrief.entities.map((item) => `- ${item}`),
    "",
    "## API Endpoints",
    ...(buildBrief.apiEndpoints.length > 0 ? buildBrief.apiEndpoints.map((item) => `- ${item}`) : ["- 없음"]),
    "",
    "## Stack",
    ...buildBrief.stack.map((item) => `- ${item}`),
    "",
    "## File Layout",
    ...buildBrief.fileLayout.map((item) => `- ${item}`),
    "",
    "## Acceptance Checks",
    ...buildBrief.acceptanceChecks.map((item) => `- ${item}`),
    "",
    "## Notes",
    ...buildBrief.notes.map((item) => `- ${item}`),
  ].join("\n");
}

function roleLabel(role: "pm" | "backend" | "frontend" | "ai" | "infra" | "test"): string {
  if (role === "pm") {
    return "PM 에이전트";
  }
  if (role === "backend") {
    return "백엔드 에이전트";
  }
  if (role === "frontend") {
    return "프론트엔드 에이전트";
  }
  if (role === "ai") {
    return "AI 전문가";
  }
  if (role === "test") {
    return "테스트 에이전트";
  }
  return "인프라 에이전트";
}

function renderCodeBlock(language: string, snippet: string): string {
  return ["```" + language, snippet.trim(), "```"].join("\n");
}
