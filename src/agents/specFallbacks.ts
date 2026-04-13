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
  TestDiscussion,
  TestSpec,
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
      "핵심 데이터를 조회하는 GET 엔드포인트를 정의한다.",
      "데이터를 생성/수정하는 POST/PUT 엔드포인트를 정의한다.",
      "상태 확인을 위한 헬스 체크 엔드포인트를 제공한다.",
    ]),
    dataModel: pickList(args.backendDiscussion.dataModel, 3, 6, [
      "핵심 도메인 엔티티의 필드와 타입을 정의한다.",
      "API 요청/응답 스키마를 명확히 한다.",
      "데이터 간 관계와 제약 조건을 정리한다.",
    ]),
    constraints: pickList(args.backendDiscussion.constraints, 2, 5, [
      "외부 API 호출 실패 시 기본값으로 fallback 한다.",
      "입력 검증과 에러 응답 형식을 통일한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "핵심 API 엔드포인트를 먼저 구현한다.",
        "데이터 모델과 검증 로직을 연결한다.",
        "에러 처리와 통합 테스트를 추가한다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "ts",
      snippet: [
        "import express from \"express\";",
        "",
        "const app = express();",
        "app.use(express.json());",
        "",
        "app.get(\"/api/health\", (req, res) => {",
        "  res.json({ ok: true });",
        "});",
        "",
        "// TODO: 핵심 API 엔드포인트 구현",
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
      "메인 화면: 핵심 기능을 사용하는 주요 화면",
      "상세 보기 화면: 데이터를 자세히 확인하는 화면",
      "설정 화면: 앱 환경을 조정하는 화면",
    ]),
    components: pickList(args.frontendDiscussion.components, 3, 6, [
      "메인 콘텐츠 영역 컴포넌트",
      "데이터 로딩/에러 상태 표시 컴포넌트",
      "사용자 입력 컴포넌트",
    ]),
    usabilityChecklist: pickList(args.frontendDiscussion.usabilityNotes, 2, 5, [
      "로딩 상태와 에러 상태가 명확히 표시되어야 한다.",
      "모바일과 데스크톱 모두에서 기본 사용이 가능해야 한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "핵심 화면의 레이아웃과 컴포넌트를 먼저 구성한다.",
        "백엔드 API와 데이터 연결을 구현한다.",
        "상태 관리와 에러 처리를 마무리한다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "tsx",
      snippet: [
        "export function App() {",
        "  return (",
        "    <main className=\"app\">",
        "      <Header />",
        "      <MainContent />",
        "      <Footer />",
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
      "사용자 요청에서 핵심 데이터를 자동으로 처리한다.",
      "외부 데이터를 가공하여 의미 있는 결과를 제공한다.",
      "규칙 기반 추천 또는 필터링 기능을 제공한다.",
    ]),
    feasibilityNotes: pickList(args.aiDiscussion.feasibility, 2, 5, [
      "외부 API를 활용하면 MVP 수준에서 충분히 구현 가능하다.",
      "복잡한 ML 없이 규칙 기반으로 먼저 구현할 수 있다.",
    ]),
    guardrails: pickList(args.aiDiscussion.risks, 2, 5, [
      "외부 API 실패 시 기본값으로 대체한다.",
      "불확실한 결과에는 신뢰도 표시를 포함한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "외부 API 연동 모듈을 먼저 구현한다.",
        "데이터 가공 및 변환 로직을 추가한다.",
        "에러 처리와 fallback 로직을 검증한다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "ts",
      snippet: [
        "export async function processData(input: string) {",
        "  try {",
        "    const rawData = await fetchExternalApi(input);",
        "    return transformData(rawData);",
        "  } catch {",
        "    return getDefaultResult();",
        "  }",
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
      "로컬에서 바로 실행 가능한 개발 서버를 구성한다.",
      "필요한 외부 서비스 연결을 설정한다.",
      "환경 변수 파일로 설정을 분리한다.",
    ]),
    environments: pickList(args.infraDiscussion.environments, 3, 6, [
      "local: 개발자 로컬 실행 환경",
      "staging: 배포 전 통합 검증 환경",
      "production: 운영 환경",
    ]),
    operationsChecklist: pickList(args.infraDiscussion.observability, 2, 5, [
      "앱 실행 상태를 확인할 수 있는 헬스 체크를 제공한다.",
      "에러 로그와 실행 로그를 수집한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "실행 환경과 의존성 설정을 정리한다.",
        "환경 변수 예시 파일을 만든다.",
        "실행 스크립트와 헬스 체크를 검증한다.",
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

export function buildDeterministicTestSpec(args: {
  finalDecision: PMFinalDecision;
  testDiscussion: TestDiscussion;
}): TestSpec {
  return {
    overview: [
      "구조화 응답이 흔들려도 검증 기준이 사라지지 않도록 테스트 명세를 deterministic fallback으로 복원합니다.",
      args.testDiscussion.summary,
      `PM 최종 결정은 ${args.finalDecision.finalDecision}`,
    ].join(" "),
    testStrategy: pickList(args.testDiscussion.testApproach, 3, 6, [
      "핵심 API에 대한 기본 동작 테스트를 먼저 만든다.",
      "주요 데이터 흐름을 검증하는 통합 테스트를 만든다.",
      "앱이 실행되는지 확인하는 smoke test를 포함한다.",
    ]),
    testScenarios: pickList(args.testDiscussion.coverageFocus, 3, 6, [
      "헬스 체크 엔드포인트가 정상 응답한다.",
      "핵심 API가 올바른 데이터를 반환한다.",
      "에러 상황에서 적절한 에러 응답을 반환한다.",
    ]),
    qualityGates: pickList(args.testDiscussion.qualityRisks, 2, 5, [
      "테스트 실패 시 다음 단계로 넘기지 않는다.",
      "API 스키마가 변경되면 관련 테스트도 함께 업데이트한다.",
    ]),
    implementationSteps: pickList(
      [
        ...args.finalDecision.deliveryPlan,
        "node:test 기반 테스트 파일을 만든다.",
        "핵심 API 동작 검증을 추가한다.",
        "실행 명령과 테스트 명령을 문서에 남긴다.",
      ],
      3,
      6,
      [],
    ),
    exampleCode: {
      language: "js",
      snippet: [
        "import assert from \"node:assert/strict\";",
        "import test from \"node:test\";",
        "",
        "test(\"health endpoint returns ok\", async () => {",
        "  const response = await fetch(\"http://127.0.0.1:4040/api/health\");",
        "  const payload = await response.json();",
        "  assert.equal(response.status, 200);",
        "  assert.equal(payload.ok, true);",
        "});",
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
