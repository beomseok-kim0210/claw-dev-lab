import type { AIFeaturesSpec, BackendSpec, FrontendSpec, PMFinalDecision } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildImplementationPlanPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "implementation",
    objective: "설계 결과를 실제 구현 작업 단위로 분해하고 역할별 실행 순서를 고정한다.",
    responsibilities: [
      "백엔드, 프론트엔드, AI 관점을 하나의 구현 계획으로 통합한다.",
      "작업 순서, 의존성, 산출물, 완료 기준을 명확하게 정의한다.",
      "다음 단계에서 실제 코드 변경 에이전트가 바로 사용할 수 있는 시작 지시문을 제공한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "PM MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "백엔드 명세 개요", lines: [args.backendSpec.overview, ...args.backendSpec.implementationSteps.map((item) => `- ${item}`)] },
      { title: "프론트엔드 명세 개요", lines: [args.frontendSpec.overview, ...args.frontendSpec.implementationSteps.map((item) => `- ${item}`)] },
      { title: "AI 명세 개요", lines: [args.aiFeaturesSpec.overview, ...args.aiFeaturesSpec.implementationSteps.map((item) => `- ${item}`)] },
    ],
    contract: {
      schemaLines: [
        '  "overview": "전체 구현 전략을 요약한 한 단락",',
        '  "milestones": ["마일스톤 1", "마일스톤 2", "마일스톤 3"],',
        '  "tasks": [',
        '    {',
        '      "id": "task-01",',
        '      "title": "작업 제목",',
        '      "owner": "backend",',
        '      "goal": "이 작업의 목표",',
        '      "deliverables": ["산출물 1", "산출물 2"],',
        '      "acceptanceCriteria": ["완료 기준 1", "완료 기준 2"]',
        "    }",
        "  ],",
        '  "validationChecklist": ["검증 항목 1", "검증 항목 2", "검증 항목 3"],',
        '  "kickoffPrompt": "다음 구현 에이전트가 바로 실행할 수 있는 시작 지시문"',
      ],
      constraints: [
        "tasks는 정확히 4개로 작성하고 배열 순서가 실행 순서다",
        "각 task.id는 task-01 형식을 사용",
        "owner는 pm, backend, frontend, ai 중 하나만 사용",
        "deliverables는 실제 구현 결과물 관점으로 작성",
        "acceptanceCriteria는 검증 가능한 문장으로 작성",
        "kickoffPrompt는 실제 구현 에이전트에게 바로 전달 가능한 수준으로 구체적으로 작성",
      ],
    },
  });
}
