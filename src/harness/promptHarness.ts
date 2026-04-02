import type { AgentRole, ChatMessage } from "../types/chat.js";

export type HarnessMode = "discussion" | "artifact" | "implementation";

type HarnessContextBlock = {
  title: string;
  lines: string[];
};

type HarnessContract = {
  schemaLines: string[];
  constraints: string[];
};

type HarnessPromptArgs = {
  role: AgentRole;
  mode: HarnessMode;
  objective: string;
  responsibilities: string[];
  userRequest: string;
  messages?: ChatMessage[];
  contextBlocks?: HarnessContextBlock[];
  contract: HarnessContract;
};

const ROLE_LABELS: Record<AgentRole, string> = {
  pm: "PM 에이전트",
  backend: "백엔드 에이전트",
  frontend: "프론트엔드 에이전트",
  ai: "AI 전문가",
};

const COMMON_SYSTEM_RULES = [
  "사람이 읽는 문장과 목록 항목은 모두 한국어로 작성한다.",
  "JSON 키, message ID, 코드 식별자, 파일명은 필요할 때만 영어를 유지한다.",
  "유효한 JSON만 반환하고, JSON 바깥의 설명 문장은 추가하지 않는다.",
  "역할 밖의 결정을 대신 내리지 않는다.",
  "모호한 표현보다 실행 가능한 표현을 우선한다.",
];

const MODE_RULES: Record<HarnessMode, string[]> = {
  discussion: [
    "공유 채팅방의 토론 하네스 안에서 동작한다.",
    "응답 전에 전체 대화 기록을 읽고, 이전 메시지의 흐름을 이어받아야 한다.",
    "references 필드에는 실제로 참조한 메시지 ID만 넣어야 한다.",
    "한 라운드 토론 단계이므로 범위를 불필요하게 확장하지 않는다.",
  ],
  artifact: [
    "최종 산출물 하네스 안에서 동작한다.",
    "PM의 최종 결정을 기준선으로 삼고, 범위를 임의로 넓히지 않는다.",
    "구현 가능한 단계, 구조, 예시를 구체적으로 제공한다.",
    "일반론보다 이 프로젝트에 바로 적용 가능한 내용을 우선한다.",
  ],
  implementation: [
    "구현 실행 하네스 안에서 동작한다.",
    "결정된 스펙을 실제 작업 단위로 분해한다.",
    "필요한 입력, 출력, 변경 범위를 명확하게 적는다.",
    "검증 가능한 완료 조건을 포함한다.",
  ],
};

export function buildHarnessPrompt(args: HarnessPromptArgs): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    `역할: ${ROLE_LABELS[args.role]}`,
    `모드: ${args.mode}`,
    `목표: ${args.objective}`,
    "핵심 책임:",
    ...args.responsibilities.map((item) => `- ${item}`),
    "공통 규칙:",
    ...COMMON_SYSTEM_RULES.map((item) => `- ${item}`),
    "모드 규칙:",
    ...MODE_RULES[args.mode].map((item) => `- ${item}`),
  ].join("\n");

  const sections: string[] = [];
  if (args.messages) {
    sections.push(renderDiscussionContext(args.userRequest, args.messages));
  } else {
    sections.push(`사용자 요청: ${args.userRequest}`);
  }

  for (const block of args.contextBlocks ?? []) {
    sections.push(renderContextBlock(block));
  }

  sections.push("반드시 아래 키만 포함한 JSON을 반환하라:");
  sections.push("{");
  sections.push(...args.contract.schemaLines);
  sections.push("}");
  sections.push("");
  sections.push("제약 조건:");
  sections.push(...args.contract.constraints.map((item) => `- ${item}`));

  return {
    systemPrompt,
    userPrompt: sections.join("\n\n"),
  };
}

export function renderTranscript(messages: ChatMessage[]): string {
  return messages
    .map((message) =>
      [
        `[${message.id}] turn=${message.turn} speaker=${message.speaker} role=${message.role}`,
        message.content,
      ].join("\n"),
    )
    .join("\n\n");
}

export function renderMessageIds(messages: ChatMessage[]): string {
  return messages.map((message) => message.id).join(", ");
}

export function renderDiscussionContext(userRequest: string, messages: ChatMessage[]): string {
  return [
    `사용자 요청: ${userRequest}`,
    `참조 가능한 메시지 ID: ${renderMessageIds(messages)}`,
    "대화 기록:",
    renderTranscript(messages),
  ].join("\n\n");
}

function renderContextBlock(block: HarnessContextBlock): string {
  return [block.title, ...block.lines].join("\n");
}
