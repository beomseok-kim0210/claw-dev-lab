import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildImplementationPlanPrompt } from "../prompts/implementation.js";
import {
  implementationPlanSchema,
  type AIFeaturesSpec,
  type BackendSpec,
  type FrontendSpec,
  type ImplementationPlan,
  type InfraSpec,
  type PMFinalDecision,
  type TestSpec,
} from "../types/contracts.js";

type ImplementationPlannerArgs = {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
  testSpec: TestSpec;
};

export async function generateImplementationPlan(args: ImplementationPlannerArgs): Promise<ImplementationPlan> {
  const prompt = buildImplementationPlanPrompt(args);
  const profile = resolveGenerationProfile(args.client.getModelName(), "implementation-plan");

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: implementationPlanSchema,
      ...profile,
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
      "역할별 구현 결과를 통합하고 테스트 에이전트가 품질 게이트를 통과시킨다.",
    ].filter((item): item is string => Boolean(item && item.trim().length > 0)),
    3,
  );

  const tasks: ImplementationPlan["tasks"] = [
    {
      id: "task-01",
      title: "MVP 범위와 작업 기준 확정",
      owner: "pm",
      goal: "최종 MVP 범위와 제외 범위를 모든 역할이 같은 기준으로 사용하도록 정리한다.",
      deliverables: takeAtLeast(
        [
          `MVP 범위 정리: ${args.finalDecision.mvpScope[0] ?? "핵심 기능 우선순위 확정"}`,
          `비목표 정리: ${args.finalDecision.nonGoals[0] ?? "후속 단계 기능 분리"}`,
        ],
        2,
      ),
      acceptanceCriteria: takeAtLeast(
        [
          "모든 역할이 같은 MVP 범위를 기준으로 구현을 시작할 수 있다.",
          "이번 세션에서 다루지 않을 범위가 분명하게 분리되어 있다.",
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
          args.backendSpec.implementationSteps[0] ?? "백엔드 주요 단계가 구현되어야 한다.",
          args.backendSpec.constraints[0] ?? "주요 기술 제약이 반영되어야 한다.",
        ],
        2,
      ),
    },
    {
      id: "task-03",
      title: "프론트 화면과 상호작용 구현",
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
          args.frontendSpec.implementationSteps[0] ?? "프론트엔드 주요 단계가 구현되어야 한다.",
          args.frontendSpec.usabilityChecklist[0] ?? "사용성 기준이 반영되어야 한다.",
        ],
        2,
      ),
    },
    {
      id: "task-04",
      title: "AI 로직과 인사이트 흐름 구현",
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
    {
      id: "task-05",
      title: "실행 환경과 운영 경로 정리",
      owner: "infra",
      goal: args.infraSpec.overview,
      deliverables: takeAtLeast(
        [
          args.infraSpec.deploymentTopology[0] ?? "배포 토폴로지 정리",
          args.infraSpec.environments[0] ?? "환경 분리 설정 정리",
        ],
        2,
      ),
      acceptanceCriteria: takeAtLeast(
        [
          args.infraSpec.implementationSteps[0] ?? "인프라 주요 단계가 구현되어야 한다.",
          args.infraSpec.operationsChecklist[0] ?? "운영 체크리스트가 반영되어야 한다.",
        ],
        2,
      ),
    },
    {
      id: "task-06",
      title: "품질 게이트와 회귀 테스트 구성",
      owner: "test",
      goal: args.testSpec.overview,
      deliverables: takeAtLeast(
        [
          args.testSpec.testStrategy[0] ?? "핵심 테스트 전략 정리",
          args.testSpec.testScenarios[0] ?? "핵심 시나리오 테스트 구현",
        ],
        2,
      ),
      acceptanceCriteria: takeAtLeast(
        [
          args.testSpec.implementationSteps[0] ?? "테스트 자동화 단계가 구현되어야 한다.",
          args.testSpec.qualityGates[0] ?? "품질 게이트가 실행 결과로 확인되어야 한다.",
        ],
        2,
      ),
    },
  ];

  return {
    overview: [
      "PM 최종 결정과 역할별 명세를 기준으로 구현 순서를 고정한다.",
      "백엔드, 프론트엔드, AI, 인프라, 테스트가 같은 세션 안에서 코드 생성과 리뷰를 이어간다.",
    ].join(" "),
    milestones,
    tasks,
    validationChecklist: takeAtLeast(
      [
        "PM이 정한 MVP 범위와 제외 범위가 실제 생성 코드와 테스트에 반영되어야 한다.",
        "역할별 생성물과 테스트 결과가 서로 충돌하지 않고 하나의 실행 경로로 연결되어야 한다.",
        "테스트 에이전트의 품질 게이트가 마지막까지 유지되어야 한다.",
      ],
      2,
    ),
    kickoffPrompt: [
      "PM 최종 결정과 implementation-plan.md를 기준으로 task-01부터 task-06까지 이어서 진행하라.",
      "각 task는 deliverables와 acceptanceCriteria를 실제 파일과 검증 결과로 남겨야 한다.",
      `사용자 요청: ${args.userRequest}`,
    ].join(" "),
  };
}

function takeAtLeast(items: string[], minimum: number): string[] {
  const filtered = items.filter((item) => item.trim().length > 0);
  while (filtered.length < minimum) {
    filtered.push("추가 구현 검토가 필요합니다.");
  }
  return filtered;
}
