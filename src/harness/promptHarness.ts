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
  infra: "인프라 에이전트",
};

const COMMON_SYSTEM_RULES = [
  "모든 설명과 목록은 한국어로 작성한다.",
  "JSON 안의 message ID, 코드 언어, 파일명은 필요한 경우에만 영어를 사용한다.",
  "유효한 JSON만 반환하고, JSON 바깥에 설명 문장을 추가하지 않는다.",
  "모호한 낙관보다 실제 구현에 도움이 되는 구체성을 우선한다.",
];

const MODE_RULES: Record<HarnessMode, string[]> = {
  discussion: [
    "공유 채팅방의 토론 하네스 안에서 동작한다.",
    "전체 대화 기록을 읽고 특정 메시지에 대한 동의나 반박을 분명히 적는다.",
    "충돌 지점이 있으면 흐리지 말고 이유를 짧고 명확하게 말한다.",
  ],
  artifact: [
    "최종 산출물 하네스 안에서 동작한다.",
    "PM 최종 결정을 기준으로만 판단하고 범위를 임의로 넓히지 않는다.",
    "문서가 실제 구현에 바로 연결되도록 구조, 단계, 예시를 구체적으로 쓴다.",
  ],
  implementation: [
    "구현 실행 하네스 안에서 동작한다.",
    "문서 결과를 실제 파일 작업 단위로 분해한다.",
    "검증 포인트와 완료 기준이 있는 실무형 결과를 만들어야 한다.",
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
    "담당 책임:",
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

  sections.push("반드시 아래 형태만 포함한 JSON을 반환하라:");
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
