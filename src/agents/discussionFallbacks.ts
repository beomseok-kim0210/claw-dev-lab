import type { ChatMessage } from "../types/chat.js";
import type {
  AIDiscussion,
  AgentReaction,
  BackendDiscussion,
  FrontendDiscussion,
  InfraDiscussion,
  PMFinalDecision,
  PMInitialDiscussion,
  TestDiscussion,
} from "../types/contracts.js";

type Role = "backend" | "frontend" | "ai" | "infra" | "test";

export function buildDeterministicPmInitialDiscussion(args: {
  userRequest: string;
  messages: ChatMessage[];
}): PMInitialDiscussion {
  const req = shrink(args.userRequest);
  return {
    headline: "PM 초기 문제 정의",
    problemStatement: `사용자 요청을 실행 가능한 협업 범위로 줄여야 합니다. 핵심 요청은 "${req}" 입니다.`,
    mvpGoals: ensureMin(
      [
        `"${req}" 의 핵심 기능을 최소 단위로 동작하게 만든다.`,
        "사용자 요청에서 가장 중요한 기능 1개를 우선 구현한다.",
        "MVP 범위를 넘어서는 기능은 별도로 분리한다.",
      ],
      2,
    ),
    successCriteria: ensureMin(
      [
        "핵심 기능이 정상 동작하는 것을 확인할 수 있다.",
        "사용자가 결과물을 바로 실행해 볼 수 있다.",
        "코드가 실행 가능한 상태로 생성된다.",
      ],
      2,
    ),
    references: takeReferences(args.messages),
  };
}

export function buildDeterministicPmFinalDecision(args: {
  userRequest: string;
  messages: ChatMessage[];
}): PMFinalDecision {
  const req = shrink(args.userRequest);
  return {
    headline: "PM 최종 결정",
    summary: `요청 "${req}" 에 대해 MVP 범위를 확정하고, 역할별 명세와 코드 생성으로 이어갑니다.`,
    mvpScope: ensureMin(
      [
        `"${req}" 의 핵심 기능을 구현한다.`,
        "기본 UI와 백엔드 API를 연결한다.",
        "실행 가능한 코드를 생성한다.",
      ],
      3,
    ),
    nonGoals: ensureMin(
      [
        "프로덕션 배포 및 CI/CD 파이프라인은 포함하지 않는다.",
        "사용자 인증 및 결제 시스템은 MVP 범위 밖이다.",
      ],
      2,
    ),
    deliveryPlan: ensureMin(
      [
        "역할별 토론을 바탕으로 기술 방향을 정리한다.",
        "명세를 확정한 뒤 코드 생성으로 이어간다.",
        "생성된 코드를 검증하고 수정한다.",
      ],
      3,
    ),
    finalDecision: `"${req}" 요청에 대해 핵심 기능 중심의 MVP를 구현합니다. 백엔드 API, 프론트엔드 UI, 필요 시 AI 기능을 포함하며 실행 가능한 코드를 산출합니다.`,
    references: takeReferences(args.messages, 3),
  };
}

export function buildDeterministicBackendDiscussion(args: {
  userRequest: string;
  messages: ChatMessage[];
}): BackendDiscussion {
  const req = shrink(args.userRequest);
  return {
    headline: "백엔드 관점 제안",
    summary: `"${req}" 를 위한 서버 구조와 데이터 흐름을 정리해야 합니다.`,
    claim: "핵심 기능에 필요한 API 엔드포인트와 데이터 모델을 먼저 정의해야 합니다.",
    support: ensureMin(
      [
        "사용자 요청의 핵심 동작을 지원하는 API가 명확해야 프론트엔드와 연결됩니다.",
        "데이터 모델이 먼저 정해져야 프론트엔드와 AI 기능이 안정적으로 연결됩니다.",
        "에러 처리와 기본 검증 로직이 포함되어야 합니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "backend"),
    rebuttal: "프론트엔드와 AI 기능도 결국 백엔드 API 위에서 동작하므로 데이터 계약이 먼저 필요합니다.",
    apiDesign: ensureMin(
      [
        `사용자 요청 "${req}" 의 핵심 데이터를 조회하는 GET 엔드포인트`,
        `핵심 데이터를 생성/수정하는 POST/PUT 엔드포인트`,
        `상태 확인을 위한 헬스 체크 엔드포인트`,
      ],
      3,
    ),
    dataModel: ensureMin(
      [
        "핵심 도메인 엔티티와 필드를 정의합니다.",
        "API 요청/응답 스키마를 명확히 합니다.",
      ],
      2,
    ),
    constraints: ensureMin(
      [
        "외부 API 호출 실패 시 기본값으로 fallback 합니다.",
        "입력 검증과 에러 응답 형식을 통일합니다.",
      ],
      2,
    ),
    references: takeReferences(args.messages, 3),
  };
}

export function buildDeterministicFrontendDiscussion(args: {
  userRequest: string;
  messages: ChatMessage[];
}): FrontendDiscussion {
  const req = shrink(args.userRequest);
  return {
    headline: "프론트엔드 관점 제안",
    summary: `"${req}" 를 위한 사용자 화면과 상호작용 흐름을 정리해야 합니다.`,
    claim: "사용자가 핵심 기능을 직관적으로 사용할 수 있는 화면 구성이 우선입니다.",
    support: ensureMin(
      [
        "핵심 기능이 첫 화면에서 바로 접근 가능해야 합니다.",
        "데이터 로딩 상태와 에러 상태를 명확히 보여줘야 합니다.",
        "모바일과 데스크톱 모두에서 기본 사용이 가능해야 합니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "frontend"),
    rebuttal: "백엔드 API가 완벽해도 사용자가 화면에서 기능을 찾지 못하면 의미가 없습니다.",
    screens: ensureMin(
      [
        `"${req}" 의 핵심 기능을 보여주는 메인 화면`,
        "설정 및 환경 조정 화면",
        "데이터 상세 보기 화면",
      ],
      3,
    ),
    components: ensureMin(
      [
        "메인 콘텐츠 표시 컴포넌트",
        "데이터 로딩/에러 상태 컴포넌트",
        "사용자 입력 컴포넌트",
        "네비게이션 컴포넌트",
      ],
      3,
    ),
    usabilityNotes: ensureMin(
      [
        "로딩 중에는 스켈레톤 UI를 보여줍니다.",
        "에러 발생 시 사용자에게 명확한 안내 메시지를 표시합니다.",
      ],
      2,
    ),
    references: takeReferences(args.messages, 3),
  };
}

export function buildDeterministicAIDiscussion(args: {
  userRequest: string;
  messages: ChatMessage[];
}): AIDiscussion {
  const req = shrink(args.userRequest);
  return {
    headline: "AI 관점 제안",
    summary: `"${req}" 에 AI 또는 지능형 기능이 필요한 부분을 정리합니다.`,
    claim: "사용자 요청에서 자동화하거나 지능적으로 처리할 수 있는 부분을 식별해야 합니다.",
    support: ensureMin(
      [
        "단순 CRUD를 넘어서는 지능형 처리가 필요한 부분이 있는지 확인해야 합니다.",
        "외부 API나 데이터 분석이 필요한 경우 적절한 기술을 선택해야 합니다.",
        "AI 기능이 없더라도 데이터 가공 및 추천 로직은 고려할 수 있습니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "ai"),
    rebuttal: "기능만 구현하고 데이터 활용 전략이 없으면 앱의 차별화가 어렵습니다.",
    aiFeatures: ensureMin(
      [
        `"${req}" 에서 자동화할 수 있는 데이터 처리 기능`,
        "사용자 맞춤형 추천 또는 필터링 기능",
        "외부 데이터 연동 및 가공 기능",
      ],
      3,
    ),
    feasibility: ensureMin(
      [
        "외부 API를 활용하면 MVP 수준에서 충분히 구현 가능합니다.",
        "복잡한 ML 모델 없이 규칙 기반으로 먼저 구현할 수 있습니다.",
      ],
      2,
    ),
    risks: ensureMin(
      [
        "외부 API 의존도가 높으면 서비스 안정성에 영향을 줄 수 있습니다.",
        "데이터 품질이 낮으면 결과 신뢰성이 떨어질 수 있습니다.",
      ],
      2,
    ),
    references: takeReferences(args.messages, 3),
  };
}

export function buildDeterministicInfraDiscussion(args: {
  userRequest: string;
  messages: ChatMessage[];
}): InfraDiscussion {
  const req = shrink(args.userRequest);
  return {
    headline: "인프라 관점 제안",
    summary: `"${req}" 를 실행할 수 있는 환경과 배포 구조를 정리합니다.`,
    claim: "MVP라도 실행 환경이 정리돼야 구현 결과를 바로 확인할 수 있습니다.",
    support: ensureMin(
      [
        "생성된 코드의 실행 방법이 명확해야 결과를 확인할 수 있습니다.",
        "개발 환경 설정이 간단해야 빠르게 시작할 수 있습니다.",
        "환경 변수와 설정 파일을 분리해야 유지보수가 쉽습니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "infra"),
    rebuttal: "코드가 완벽해도 실행 환경이 없으면 결과물이 반쪽짜리입니다.",
    deploymentTopology: ensureMin(
      [
        "로컬에서 바로 실행 가능한 개발 서버 구성",
        "필요한 외부 서비스 연결 설정",
        "환경 변수 파일로 설정 분리",
      ],
      3,
    ),
    environments: ensureMin(
      [
        "local 개발 환경",
        "staging 검증 환경",
      ],
      2,
    ),
    observability: ensureMin(
      [
        "앱 실행 상태를 확인할 수 있는 로그를 남깁니다.",
        "에러 발생 시 원인을 파악할 수 있는 정보를 포함합니다.",
      ],
      2,
    ),
    references: takeReferences(args.messages, 3),
  };
}

export function buildDeterministicTestDiscussion(args: {
  userRequest: string;
  messages: ChatMessage[];
}): TestDiscussion {
  const req = shrink(args.userRequest);
  return {
    headline: "테스트 관점 제안",
    summary: `"${req}" 의 핵심 기능이 정상 동작하는지 확인할 수 있는 검증 전략을 정리합니다.`,
    claim: "핵심 기능에 대한 기본 테스트가 있어야 코드 품질을 보장할 수 있습니다.",
    support: ensureMin(
      [
        "핵심 API 엔드포인트가 정상 응답하는지 확인해야 합니다.",
        "사용자 시나리오의 주요 경로가 동작하는지 검증해야 합니다.",
        "외부 API 연동 부분의 에러 처리가 정상인지 확인해야 합니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "test"),
    rebuttal: "구현이 완벽해도 검증이 없으면 변경 시 회귀 버그를 놓치기 쉽습니다.",
    testApproach: ensureMin(
      [
        "핵심 API에 대한 기본 동작 테스트를 만든다.",
        "주요 사용자 시나리오를 검증하는 통합 테스트를 만든다.",
        "앱이 실행되는지 확인하는 smoke test를 포함한다.",
      ],
      3,
    ),
    coverageFocus: ensureMin(
      [
        "핵심 기능의 정상 경로를 우선 검증한다.",
        "에러 처리 경로가 올바르게 동작하는지 확인한다.",
      ],
      2,
    ),
    qualityRisks: ensureMin(
      [
        "테스트 없이 코드만 생성되면 회귀가 누적될 수 있습니다.",
        "외부 API 의존 부분은 모킹 없이 테스트하면 불안정합니다.",
      ],
      2,
    ),
    references: takeReferences(args.messages, 3),
  };
}

export function buildDeterministicReaction(args: {
  role: Role;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
}): AgentReaction {
  return {
    headline: `${roleLabel(args.role)} 반응 메모`,
    reactionType: "refine",
    targetMessageId: args.targetMessage.id,
    position: `${roleLabel(args.role)} 관점에서는 현재 제안의 방향은 맞지만 구체적인 연결 부분을 보완해야 합니다.`,
    reaction: "현재 제안의 방향은 좋지만, 실제 구현에서 어떤 입력과 출력이 연결되는지 더 명확히 해야 합니다.",
    adjustment: "구체적인 데이터 흐름과 인터페이스를 명시하여 후속 구현에서 바로 사용할 수 있게 합니다.",
    references: takeReferences(args.messages, 3),
  };
}

function takeReferences(messages: ChatMessage[], limit = 2): string[] {
  const ids = messages
    .slice(-limit)
    .map((message) => message.id)
    .filter((value, index, array) => array.indexOf(value) === index);

  return ids.length > 0 ? ids : ["msg-001"];
}

function pickRebuttalTarget(messages: ChatMessage[], role: Role): string {
  const target = [...messages].reverse().find((message) => message.role !== "user" && message.role !== role);
  return target?.id ?? "없음";
}

function ensureMin(items: string[], minimum: number): string[] {
  const unique = items
    .map((item) => item.trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

  while (unique.length < minimum) {
    unique.push(`추가 정리 항목 ${unique.length + 1}`);
  }

  return unique;
}

function shrink(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function roleLabel(role: Role): string {
  if (role === "backend") {
    return "백엔드";
  }
  if (role === "frontend") {
    return "프론트엔드";
  }
  if (role === "infra") {
    return "인프라";
  }
  if (role === "test") {
    return "테스트";
  }
  return "AI";
}
