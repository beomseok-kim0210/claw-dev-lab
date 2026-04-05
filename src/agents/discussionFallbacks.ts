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
  return {
    headline: "PM 초기 문제 정의",
    problemStatement: `사용자 요청을 실행 가능한 협업 범위로 줄여야 합니다. 핵심 요청은 "${shrink(args.userRequest)}" 입니다.`,
    mvpGoals: ensureMin(
      [
        "멀티 에이전트가 같은 채팅방에서 역할별로 의견을 남긴다.",
        "PM이 최종 범위를 정리하고 이후 명세와 구현으로 연결한다.",
        "모호한 정보는 질문으로 다시 확인한다.",
      ],
      2,
    ),
    successCriteria: ensureMin(
      [
        "역할별 발언과 참조 메시지 ID가 남는다.",
        "최종 산출물에 명세와 코드 파일이 함께 생성된다.",
        "질문이 필요할 때 세션이 멈추고 사용자 답변 후 재개된다.",
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
  return {
    headline: "PM 최종 결정",
    summary: `요청 "${shrink(args.userRequest)}" 에 대해 대화형 토론, 사용자 확인, 명세 생성, 코드 생성이 한 세션에서 이어지는 MVP로 확정합니다.`,
    mvpScope: ensureMin(
      [
        "PM, 백엔드, 프론트엔드, AI, 인프라가 같은 채팅방에서 대화한다.",
        "필요 시 사용자 확인 질문을 띄우고 답변을 반영한다.",
        "최종적으로 명세 문서와 generated-app 코드 파일을 만든다.",
      ],
      3,
    ),
    nonGoals: ensureMin(
      [
        "실제 외부 SaaS 연동이나 다중 저장소 배포까지는 포함하지 않는다.",
        "사람 개발자 없이 완전 자율 릴리스까지는 다루지 않는다.",
      ],
      2,
    ),
    deliveryPlan: ensureMin(
      [
        "역할별 자유 토론과 반응 메시지를 먼저 정리한다.",
        "질문이 필요한 항목을 사용자에게 확인한다.",
        "명세와 구현 계획을 만든 뒤 생성 코드까지 이어간다.",
      ],
      3,
    ),
    finalDecision:
      "이 MVP는 토론형 기획, 사용자 확인, 역할별 명세, 코드 생성, 인프라 초안까지 한 세션에서 수행하는 협업 워크스페이스로 진행합니다.",
    references: takeReferences(args.messages, 3),
  };
}

export function buildDeterministicBackendDiscussion(args: {
  userRequest: string;
  messages: ChatMessage[];
}): BackendDiscussion {
  return {
    headline: "백엔드 관점 제안",
    summary: "세션 상태와 산출물을 같은 API 흐름으로 묶어야 전체 협업이 안정적으로 이어집니다.",
    claim: "세션 생성, 상태 조회, 질문 응답, 산출물 다운로드 API를 먼저 고정해야 합니다.",
    support: ensureMin(
      [
        "토론과 구현은 같은 세션 ID를 기준으로 이어져야 합니다.",
        "질문 응답이 들어오면 중단된 오케스트레이션을 같은 상태에서 재개해야 합니다.",
        "산출물과 채팅 로그는 동일한 조회 모델을 따라야 합니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "backend"),
    rebuttal: "프론트나 AI 요구사항도 결국 세션 API와 데이터 계약 위에서 안정적으로 연결되어야 합니다.",
    apiDesign: ensureMin(
      [
        "POST /api/sessions 로 새 협업 세션을 생성합니다.",
        "GET /api/sessions/:id 로 전체 스냅샷을 조회합니다.",
        "POST /api/sessions/:id/clarifications 로 질문 답변을 제출합니다.",
      ],
      3,
    ),
    dataModel: ensureMin(
      [
        "SessionSnapshot 은 상태, 단계, transcript, artifacts 를 포함합니다.",
        "Clarification 은 질문 목록, 답변 목록, pending/answered 상태를 가집니다.",
        "Artifact 는 파일명, 다운로드 URL, 본문을 가집니다.",
      ],
      2,
    ),
    constraints: ensureMin(
      [
        "Ollama 응답이 불안정해도 세션이 실패하지 않도록 fallback 이 필요합니다.",
        "긴 실행 중에도 UI가 진행 상황을 잃지 않도록 SSE 스트림이 유지되어야 합니다.",
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
  return {
    headline: "프론트엔드 관점 제안",
    summary: "사용자는 토론, 질문, 산출물, 생성 코드를 한 화면에서 연속적으로 봐야 합니다.",
    claim: "채팅방 UI 안에서 주장, 반박, 질문 카드, 산출물 탭이 자연스럽게 이어져야 합니다.",
    support: ensureMin(
      [
        "기획과 구현이 분리된 화면보다 같은 세션 화면이 사용자 이해에 유리합니다.",
        "질문이 생기면 같은 세션에서 바로 답변해야 흐름이 끊기지 않습니다.",
        "생성 코드도 산출물 탭에서 바로 확인해야 합니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "frontend"),
    rebuttal: "API가 아무리 잘 정리돼도 사용자가 흐름을 이해하지 못하면 협업 경험이 무너집니다.",
    screens: ensureMin(
      [
        "요청 입력과 세션 상태를 보여주는 시작 패널",
        "역할별 메시지를 실시간으로 보여주는 공유 채팅방",
        "명세와 코드 파일을 탭으로 보여주는 산출물 패널",
      ],
      3,
    ),
    components: ensureMin(
      [
        "RequestComposer",
        "PhaseTimeline",
        "ClarificationCard",
        "TranscriptStream",
      ],
      3,
    ),
    usabilityNotes: ensureMin(
      [
        "현재 단계와 실패 이유가 항상 노출되어야 합니다.",
        "질문 답변 입력은 한 번에 처리할 수 있어야 합니다.",
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
  return {
    headline: "AI 관점 제안",
    summary: "단일 모델이라도 역할 프롬프트와 fallback 으로 충분히 멀티 에이전트 협업을 흉내낼 수 있습니다.",
    claim: "역할 프롬프트, 구조화 출력, 실패 시 deterministic fallback 이 함께 있어야 AI 단계가 안정적입니다.",
    support: ensureMin(
      [
        "하나의 LLM 으로도 역할 기반 응답은 충분히 분리할 수 있습니다.",
        "질문 루프가 없으면 모호한 요구사항을 잘못 가정할 위험이 큽니다.",
        "코드 생성 단계에서도 리뷰 메시지를 남겨야 협업 느낌이 유지됩니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "ai"),
    rebuttal: "모든 것을 문서화만 하고 끝내면 사용자 목표인 공동 기획과 구현까지 이어지는 흐름을 만족할 수 없습니다.",
    aiFeatures: ensureMin(
      [
        "역할 기반 구조화 응답 생성",
        "추가 확인 질문 계획 수립",
        "명세와 구현 리뷰 메시지 생성",
      ],
      3,
    ),
    feasibility: ensureMin(
      [
        "Ollama qwen3 단일 모델로도 MVP 수준의 역할 분리는 가능합니다.",
        "정확도 부족은 재시도와 deterministic fallback 으로 완화할 수 있습니다.",
      ],
      2,
    ),
    risks: ensureMin(
      [
        "JSON 형식이 깨질 수 있으므로 단계별 fallback 이 필요합니다.",
        "질문 루프가 과도하면 사용자 흐름이 느려질 수 있어 최대 개수를 제한해야 합니다.",
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
  return {
    headline: "인프라 관점 제안",
    summary: "MVP라도 실행 환경, 포트, 환경 변수, 로컬 배포 방식이 정리돼야 구현 결과를 바로 확인할 수 있습니다.",
    claim: "로컬 Docker 와 단일 Node 서버 기준의 인프라 초안을 함께 제공해야 실제 검증이 쉬워집니다.",
    support: ensureMin(
      [
        "생성 코드만 있고 실행 방법이 없으면 사용자 입장에서 결과 확인이 어렵습니다.",
        "개발 환경과 실행 환경 차이를 줄이면 구현 검증이 빨라집니다.",
        "질문 루프에서 인프라 선택지를 미리 확인하면 재작업을 줄일 수 있습니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "infra"),
    rebuttal: "백엔드와 프론트엔드 초안이 있어도 배포·실행 가이드가 없으면 결과물이 반쪽짜리가 됩니다.",
    deploymentTopology: ensureMin(
      [
        "Node 서버와 정적 프론트를 같은 앱 컨테이너에서 실행합니다.",
        "로컬 Docker Compose 로 개발 환경을 재현합니다.",
        "환경 변수 파일로 포트와 모델 연결 정보를 분리합니다.",
      ],
      3,
    ),
    environments: ensureMin(
      [
        "local 개발 환경",
        "staging 검증 환경",
        "production 운영 환경",
      ],
      2,
    ),
    observability: ensureMin(
      [
        "헬스 체크 엔드포인트를 유지합니다.",
        "오류 로그와 단계 상태를 함께 확인할 수 있어야 합니다.",
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
  return {
    headline: "테스트 관점 제안",
    summary: "생성된 코드가 실제로 실행되고 역할 간 계약이 맞는지 빠르게 확인할 수 있는 검증 흐름을 먼저 고정해야 합니다.",
    claim: "smoke test, contract test, regression check를 기본 세트로 둬야 멀티 에이전트 결과물을 신뢰할 수 있습니다.",
    support: ensureMin(
      [
        "코드가 생성되더라도 실행 확인이 없으면 품질 회귀를 놓치기 쉽습니다.",
        "API, UI, AI, 인프라 제안은 서로 맞물리기 때문에 통합 검증 포인트가 필요합니다.",
        "테스트 기준이 있어야 리뷰 메시지도 단순 의견이 아니라 품질 게이트가 됩니다.",
      ],
      2,
    ),
    rebuttalTarget: pickRebuttalTarget(args.messages, "test"),
    rebuttal: "설계와 구현이 맞더라도 검증 전략이 비어 있으면 이후 다른 앱 요청에서 같은 불안정성이 반복됩니다.",
    testApproach: ensureMin(
      [
        "핵심 엔드포인트에 대한 smoke test를 만든다.",
        "공유 contract와 실제 bootstrap payload의 일치를 확인하는 contract test를 만든다.",
        "빌드 후 앱이 실제로 뜨는지 확인하는 기본 실행 검증을 포함한다.",
      ],
      3,
    ),
    coverageFocus: ensureMin(
      [
        "첫 실행 경로가 실제로 동작하는지 검증한다.",
        "역할별 생성 파일이 서로 충돌하지 않고 연결되는지 확인한다.",
      ],
      2,
    ),
    qualityRisks: ensureMin(
      [
        "테스트 스크립트 없이 코드만 생성되면 회귀가 누적될 수 있습니다.",
        "API 스키마와 프론트 렌더링 포인트가 어긋나면 앱이 빈 화면처럼 보일 수 있습니다.",
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
    position: `${roleLabel(args.role)} 관점에서는 현재 제안을 그대로 두되 연결 경계를 더 분명히 해야 합니다.`,
    reaction: "지금 제안은 방향이 맞지만, 다음 단계에서 어떤 입력과 파일이 연결되는지 더 명확히 써야 합니다.",
    adjustment: "참조 메시지와 대상 파일 또는 대상 API를 함께 적어 후속 구현자가 바로 이어받을 수 있게 합니다.",
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
