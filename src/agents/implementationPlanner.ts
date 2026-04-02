import { OllamaClient } from "../llm/ollamaClient.js";
import { buildImplementationPlanPrompt } from "../prompts/implementation.js";
import {
  implementationPlanSchema,
  type AIFeaturesSpec,
  type BackendSpec,
  type FrontendSpec,
  type ImplementationPlan,
  type PMFinalDecision,
} from "../types/contracts.js";

type ImplementationPlannerArgs = {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
};

export async function generateImplementationPlan(args: ImplementationPlannerArgs): Promise<ImplementationPlan> {
  const prompt = buildImplementationPlanPrompt(args);

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: implementationPlanSchema,
      temperature: 0.1,
      numPredict: 700,
      maxRetries: 5,
    });
  } catch {
    return buildDeterministicImplementationPlan(args);
  }
}

function buildDeterministicImplementationPlan(args: ImplementationPlannerArgs): ImplementationPlan {
  const milestones = takeAtLeast(
    [
      args.finalDecision.deliveryPlan[0],
      args.finalDecision.deliveryPlan[1],
      "역할별 구현을 통합하고 최종 검증을 수행한다.",
    ].filter((item): item is string => Boolean(item && item.trim().length > 0)),
    2,
  );

  const tasks: ImplementationPlan["tasks"] = [
    {
      id: "task-01",
      title: "MVP 범위와 작업 기준 확정",
      owner: "pm",
      goal: "최종 MVP 범위, 우선순위, 제외 범위를 구현팀이 바로 사용할 수 있는 기준으로 정리한다.",
      deliverables: takeAtLeast(
        [
          `MVP 범위 정리: ${args.finalDecision.mvpScope[0] ?? "핵심 기능 정리"}`,
          `제외 범위 정리: ${args.finalDecision.nonGoals[0] ?? "후속 단계 기능 분리"}`,
        ],
        2,
      ),
      acceptanceCriteria: takeAtLeast(
        [
          "팀이 동일한 MVP 범위를 기준으로 구현을 시작할 수 있다.",
          "후속 단계로 미루는 항목이 명확히 구분되어 있다.",
        ],
        2,
      ),
    },
    {
      id: "task-02",
      title: "백엔드 API와 데이터 구조 구현",
      owner: "backend",
      goal: args.backendSpec.overview,
      deliverables: takeAtLeast(
        [
          args.backendSpec.apiDesign[0] ?? "핵심 API 구현",
          args.backendSpec.dataModel[0] ?? "핵심 데이터 모델 구현",
        ],
        2,
      ),
      acceptanceCriteria: takeAtLeast(
        [
          args.backendSpec.implementationSteps[0] ?? "백엔드 핵심 단계가 구현되어야 한다.",
          args.backendSpec.constraints[0] ?? "주요 기술 제약이 반영되어야 한다.",
        ],
        2,
      ),
    },
    {
      id: "task-03",
      title: "프론트엔드 화면과 상호작용 구현",
      owner: "frontend",
      goal: args.frontendSpec.overview,
      deliverables: takeAtLeast(
        [
          args.frontendSpec.screens[0] ?? "핵심 화면 구현",
          args.frontendSpec.components[0] ?? "핵심 컴포넌트 구현",
        ],
        2,
      ),
      acceptanceCriteria: takeAtLeast(
        [
          args.frontendSpec.implementationSteps[0] ?? "프론트엔드 핵심 단계가 구현되어야 한다.",
          args.frontendSpec.usabilityChecklist[0] ?? "주요 사용성 기준이 반영되어야 한다.",
        ],
        2,
      ),
    },
    {
      id: "task-04",
      title: "AI 기능 연동과 검증",
      owner: "ai",
      goal: args.aiFeaturesSpec.overview,
      deliverables: takeAtLeast(
        [
          args.aiFeaturesSpec.features[0] ?? "핵심 AI 기능 연동",
          args.aiFeaturesSpec.guardrails[0] ?? "기본 가드레일 적용",
        ],
        2,
      ),
      acceptanceCriteria: takeAtLeast(
        [
          args.aiFeaturesSpec.implementationSteps[0] ?? "AI 연동 단계가 구현되어야 한다.",
          args.aiFeaturesSpec.feasibilityNotes[0] ?? "실현 가능성 메모가 검증되어야 한다.",
        ],
        2,
      ),
    },
  ];

  return {
    overview: [
      "PM 최종 결정과 역할별 명세를 기준으로 구현 순서를 확정한다.",
      "PM이 범위 기준을 고정한 뒤 백엔드, 프론트엔드, AI 작업을 순차적으로 진행하고 마지막에 통합 검증을 수행한다.",
    ].join(" "),
    milestones,
    tasks,
    validationChecklist: takeAtLeast(
      [
        "PM이 정의한 MVP 범위와 제외 범위가 구현 내용에 반영되어야 한다.",
        "백엔드, 프론트엔드, AI 기능이 같은 사용자 흐름 기준으로 연결되어야 한다.",
        "생성된 산출물과 실제 구현 결과가 서로 충돌하지 않아야 한다.",
      ],
      2,
    ),
    kickoffPrompt: [
      "PM 최종 결정과 implementation-plan.md를 기준으로 작업을 시작하라.",
      "task-01부터 task-04 순서로 진행하고, 각 task의 deliverables와 acceptanceCriteria를 충족해야 한다.",
      `핵심 사용자 요청: ${args.userRequest}`,
    ].join(" "),
  };
}

function takeAtLeast(items: string[], minimum: number): string[] {
  const filtered = items.filter((item) => item.trim().length > 0);
  while (filtered.length < minimum) {
    filtered.push("추가 구현 기준을 문서화한다.");
  }
  return filtered;
}
