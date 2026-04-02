import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  InfraSpec,
  PMFinalDecision,
} from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildImplementationPlanPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "implementation",
    objective: "명세 결과를 실제 구현 작업 단위로 분해하고 역할별 실행 순서를 고정한다.",
    responsibilities: [
      "백엔드, 프론트엔드, AI, 인프라 관점을 하나의 구현 계획으로 통합한다.",
      "작업 순서, 산출물, 완료 기준을 빠짐없이 정의한다.",
      "다음 단계 코드 실행 에이전트가 바로 움직일 수 있는 시작 지시문을 쓴다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "백엔드 명세 개요", lines: [args.backendSpec.overview, ...args.backendSpec.implementationSteps.map((item) => `- ${item}`)] },
      { title: "프론트엔드 명세 개요", lines: [args.frontendSpec.overview, ...args.frontendSpec.implementationSteps.map((item) => `- ${item}`)] },
      { title: "AI 명세 개요", lines: [args.aiFeaturesSpec.overview, ...args.aiFeaturesSpec.implementationSteps.map((item) => `- ${item}`)] },
      { title: "인프라 명세 개요", lines: [args.infraSpec.overview, ...args.infraSpec.implementationSteps.map((item) => `- ${item}`)] },
    ],
    contract: {
      schemaLines: [
        '  "overview": "전체 구현 개요",',
        '  "milestones": ["마일스톤 1", "마일스톤 2", "마일스톤 3"],',
        '  "tasks": [',
        "    {",
        '      "id": "task-01",',
        '      "title": "작업 제목",',
        '      "owner": "pm",',
        '      "goal": "작업 목표",',
        '      "deliverables": ["산출물 1", "산출물 2"],',
        '      "acceptanceCriteria": ["완료 기준 1", "완료 기준 2"]',
        "    }",
        "  ],",
        '  "validationChecklist": ["검증 항목 1", "검증 항목 2"],',
        '  "kickoffPrompt": "다음 구현 에이전트가 바로 사용할 시작 지시문"',
      ],
      constraints: [
        "tasks는 정확히 5개로 작성한다.",
        "owner는 pm, backend, frontend, ai, infra를 각각 한 번씩만 사용한다.",
        "deliverables와 acceptanceCriteria는 모두 검증 가능한 문장으로 적는다.",
        "kickoffPrompt는 다음 구현 단계가 바로 실행 가능하도록 구체적으로 적는다.",
      ],
    },
  });
}
