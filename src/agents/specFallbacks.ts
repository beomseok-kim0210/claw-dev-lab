import type {
  AIDiscussion,
  AIFeaturesSpec,
  BackendDiscussion,
  BackendSpec,
  FrontendDiscussion,
  FrontendSpec,
  InfraDiscussion,
  InfraSpec,
  PMFinalDecision,
} from "../types/contracts.js";

export function buildDeterministicBackendSpec(args: {
  finalDecision: PMFinalDecision;
  backendDiscussion: BackendDiscussion;
}): BackendSpec {
  return {
    overview: [
      "모델의 구조화 응답이 불안정할 때도 결과물을 유지하기 위해 토론 내용을 기준으로 백엔드 명세를 복원했다.",
      args.backendDiscussion.summary,
      `PM 최종 결정은 ${args.finalDecision.finalDecision}`,
    ].join(" "),
    apiDesign: pickList(args.backendDiscussion.apiDesign, 3, 6, [
      "GET /api/prd/:id: 생성된 PRD 초안과 현재 편집 상태를 조회한다.",
      "PATCH /api/prd/:id/sections: PM 수정 내용을 섹션 단위로 저장한다.",
      "GET /api/prd/:id/history: 버전별 변경 이력을 조회한다.",
    ]),
    dataModel: pickList(args.backendDiscussion.dataModel, 3, 6, [
      "PrdRevision: 문서 버전, 변경자, 변경 시각, 변경 요약을 저장한다.",
      "GeneratedSection: AI가 만든 섹션 초안과 검증 상태를 저장한다.",
      "PromptJob: 요청 원문, 추출된 기능 목록, 생성 상태를 기록한다.",
    ]),
    constraints: pickList(args.backendDiscussion.constraints, 2, 5, [
      "AI 생성 결과는 저장 전에 필수 필드와 섹션 구조를 검증해야 한다.",
      "사용자 수정본과 AI 재생성 결과가 충돌하면 마지막 변경 기준과 이력 비교가 가능해야 한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "PRD 생성 API와 수정 저장 API를 먼저 연결한다.",
        "버전 이력 조회와 생성 결과 검증 로직을 붙인다.",
        "생성, 수정, 이력 조회 흐름을 통합 테스트로 검증한다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "ts",
      snippet: [
        "type CreatePrdInput = {",
        "  projectId: string;",
        "  request: string;",
        "};",
        "",
        "export async function createPrdDraft(input: CreatePrdInput) {",
        "  const draft = await aiService.generateDraft(input.request);",
        "  return prdRepository.create({",
        "    projectId: input.projectId,",
        "    title: draft.title,",
        "    sections: draft.sections,",
        "    status: \"draft\",",
        "  });",
        "}",
      ].join("\n"),
    },
  };
}

export function buildDeterministicFrontendSpec(args: {
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): FrontendSpec {
  return {
    overview: [
      "모델의 구조화 응답이 불안정해도 화면 설계가 사라지지 않도록 토론 내용을 기준으로 프론트엔드 명세를 복원했다.",
      args.frontendDiscussion.summary,
      `PM 최종 결정은 ${args.finalDecision.finalDecision}`,
    ].join(" "),
    screens: pickList(args.frontendDiscussion.screens, 3, 6, [
      "요청 입력 화면: 사용자 요청을 작성하고 세션을 시작한다.",
      "토론 채팅방 화면: 역할별 주장, 반박, PM 결정을 실시간으로 확인한다.",
      "산출물 검토 화면: 생성된 명세와 구현 계획을 탭으로 확인한다.",
    ]),
    components: pickList(args.frontendDiscussion.components, 3, 6, [
      "RequestComposer: 요청 입력과 예시 채우기를 담당한다.",
      "TranscriptStream: 역할별 메시지 카드와 반응 유형을 렌더링한다.",
      "ArtifactTabs: markdown 산출물과 다운로드 버튼을 제공한다.",
    ]),
    usabilityChecklist: pickList(args.frontendDiscussion.usabilityNotes, 2, 5, [
      "현재 진행 중인 단계와 실패 원인을 한눈에 볼 수 있어야 한다.",
      "PM 최종 결정과 산출물 탭은 모바일에서도 읽기 쉬워야 한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "세션 생성, 단계 표시, 실시간 채팅 갱신 흐름을 연결한다.",
        "메시지 카드에서 주장, 반박 대상, 보완 제안을 구조적으로 표시한다.",
        "산출물 탭과 다운로드 동선을 마무리한다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "tsx",
      snippet: [
        "export function CollaborationWorkspace() {",
        "  return (",
        "    <main className=\"workspace\">",
        "      <RequestComposer />",
        "      <TranscriptStream />",
        "      <ArtifactTabs />",
        "    </main>",
        "  );",
        "}",
      ].join("\n"),
    },
  };
}

export function buildDeterministicAIFeaturesSpec(args: {
  finalDecision: PMFinalDecision;
  aiDiscussion: AIDiscussion;
}): AIFeaturesSpec {
  return {
    overview: [
      "모델의 구조화 응답이 흔들려도 AI 기능 범위를 유지하기 위해 토론 내용을 기준으로 AI 명세를 복원했다.",
      args.aiDiscussion.summary,
      `PM 최종 결정은 ${args.finalDecision.finalDecision}`,
    ].join(" "),
    features: pickList(args.aiDiscussion.aiFeatures, 3, 6, [
      "사용자 요청에서 핵심 기능과 범위를 추출한다.",
      "기능 목록을 바탕으로 PRD 초안과 섹션 구조를 생성한다.",
      "생성 결과에 검토 포인트와 수정 우선순위를 함께 제안한다.",
    ]),
    feasibilityNotes: pickList(args.aiDiscussion.feasibility, 2, 5, [
      "Qwen3 단일 모델로도 기능 추출과 초안 작성은 충분히 가능하다.",
      "정확도 한계가 있으므로 검증 단계와 사용자 수정 흐름이 반드시 필요하다.",
    ]),
    guardrails: pickList(args.aiDiscussion.risks, 2, 5, [
      "생성 결과에는 검증 상태와 누락 가능성 메모를 포함해야 한다.",
      "불확실한 내용은 확정 문장 대신 검토 필요 항목으로 분리해야 한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "요청 분석 프롬프트와 PRD 초안 생성 프롬프트를 분리한다.",
        "기능 추출 결과와 최종 문서 초안을 각각 검증한다.",
        "재생성 요청 시 이전 초안과 차이를 비교할 수 있게 한다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "ts",
      snippet: [
        "export async function generatePrdArtifacts(request: string) {",
        "  const features = await llm.extractFeatures(request);",
        "  const draft = await llm.composePrd({ request, features });",
        "",
        "  return {",
        "    features,",
        "    draft,",
        "    reviewNotes: await llm.findRisks(draft),",
        "  };",
        "}",
      ].join("\n"),
    },
  };
}

export function buildDeterministicInfraSpec(args: {
  finalDecision: PMFinalDecision;
  infraDiscussion: InfraDiscussion;
}): InfraSpec {
  return {
    overview: [
      "모델의 구조화 응답이 불안정해도 배포 구조가 사라지지 않도록 토론 내용을 기준으로 인프라 명세를 복원했다.",
      args.infraDiscussion.summary,
      `PM 최종 결정은 ${args.finalDecision.finalDecision}`,
    ].join(" "),
    deploymentTopology: pickList(args.infraDiscussion.deploymentTopology, 3, 6, [
      "애플리케이션 서버와 정적 프런트 자산을 분리해 배포한다.",
      "개발용과 운영용 환경 변수를 분리한다.",
      "헬스 체크와 기본 로그 수집 경로를 제공한다.",
    ]),
    environments: pickList(args.infraDiscussion.environments, 3, 6, [
      "local: 개발자 로컬 실행 환경",
      "staging: 배포 전 통합 검증 환경",
      "production: 운영 환경",
    ]),
    operationsChecklist: pickList(args.infraDiscussion.observability, 2, 5, [
      "기본 헬스 체크와 요청 로그를 수집해야 한다.",
      "배포 전 환경 변수와 포트 설정을 검증해야 한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "Dockerfile과 compose 설정으로 실행 구조를 고정한다.",
        "환경 변수 예시 파일과 운영 체크리스트를 정리한다.",
        "헬스 체크와 시작 스크립트를 검증한다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "yaml",
      snippet: [
        "services:",
        "  app:",
        "    build: .",
        "    ports:",
        "      - \"4040:4040\"",
        "    env_file:",
        "      - .env.example",
      ].join("\n"),
    },
  };
}

function pickList(items: string[], minimum: number, maximum: number, fallback: string[]): string[] {
  const unique: string[] = [];

  for (const item of [...items, ...fallback]) {
    const normalized = item.trim();
    if (!normalized || unique.includes(normalized)) {
      continue;
    }
    unique.push(normalized);
    if (unique.length === maximum) {
      break;
    }
  }

  while (unique.length < minimum) {
    unique.push(`추가 정리 항목 ${unique.length + 1}`);
  }

  return unique;
}
