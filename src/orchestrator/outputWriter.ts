import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactFileName } from "../types/chat.js";
import type { AIFeaturesSpec, BackendSpec, FrontendSpec, PMFinalDecision } from "../types/contracts.js";
import type { GeneratedArtifact } from "../types/orchestration.js";

export async function writeExecutionArtifacts(args: {
  outputDir: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
}): Promise<GeneratedArtifact[]> {
  await mkdir(args.outputDir, { recursive: true });

  const artifacts: Array<{ filename: ArtifactFileName; content: string }> = [
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
  ];

  const writtenArtifacts: GeneratedArtifact[] = [];
  for (const artifact of artifacts) {
    const absolutePath = path.resolve(args.outputDir, artifact.filename);
    await writeFile(absolutePath, artifact.content, "utf8");
    writtenArtifacts.push({
      filename: artifact.filename,
      absolutePath,
      content: artifact.content,
    });
  }

  return writtenArtifacts;
}

function renderBackendSpecMarkdown(finalDecision: PMFinalDecision, spec: BackendSpec): string {
  return [
    "# 백엔드 명세서",
    "",
    "## PM 최종 방향",
    spec.overview,
    "",
    "### 최종 MVP 방향",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## API 설계",
    ...spec.apiDesign.map((item) => `- ${item}`),
    "",
    "## 데이터 모델",
    ...spec.dataModel.map((item) => `- ${item}`),
    "",
    "## 기술 제약 사항",
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
    "# 프론트엔드 명세서",
    "",
    "## PM 최종 방향",
    spec.overview,
    "",
    "### 최종 MVP 방향",
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
    "### 최종 MVP 방향",
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

function renderCodeBlock(language: string, snippet: string): string {
  return ["```" + language, snippet.trim(), "```"].join("\n");
}
