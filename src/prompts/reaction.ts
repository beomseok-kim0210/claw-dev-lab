import type { AgentRole, ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

const ROLE_OBJECTIVES: Record<Exclude<AgentRole, "pm">, { objective: string; responsibilities: string[] }> = {
  backend: {
    objective: "지정된 메시지에 대해 백엔드 관점의 반응과 보완 제안을 남긴다.",
    responsibilities: [
      "API, 데이터 구조, 권한, 저장 방식 관점에서 빠진 요소를 짚는다.",
      "찬성하더라도 구현 연결점을 구체적으로 적는다.",
    ],
  },
  frontend: {
    objective: "지정된 메시지에 대해 프론트엔드 관점의 반응과 보완 제안을 남긴다.",
    responsibilities: [
      "사용자 흐름, 화면 구조, 상호작용 관점에서 문제를 짚는다.",
      "실제 UI 설계로 이어질 보완 포인트를 남긴다.",
    ],
  },
  ai: {
    objective: "지정된 메시지에 대해 AI 관점의 반응과 보완 제안을 남긴다.",
    responsibilities: [
      "실현 가능성, 정확도 한계, 가드레일 관점에서 검토한다.",
      "추가 자동화가 위험하면 분명히 경고한다.",
    ],
  },
  infra: {
    objective: "지정된 메시지에 대해 인프라 관점의 반응과 보완 제안을 남긴다.",
    responsibilities: [
      "배포 구조, 환경 분리, 운영 안정성 관점에서 누락을 짚는다.",
      "운영 시점의 병목과 장애 가능성을 먼저 본다.",
    ],
  },
};

export function buildReactionPrompt(args: {
  role: Exclude<AgentRole, "pm">;
  userRequest: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  const config = ROLE_OBJECTIVES[args.role];

  return buildHarnessPrompt({
    role: args.role,
    mode: "discussion",
    objective: config.objective,
    responsibilities: config.responsibilities,
    userRequest: args.userRequest,
    messages: args.messages,
    contextBlocks: [
      {
        title: "이번에 반응할 대상 메시지",
        lines: [
          `대상 ID: ${args.targetMessage.id}`,
          `발화자: ${args.targetMessage.speaker}`,
          "본문:",
          args.targetMessage.content,
        ],
      },
    ],
    contract: {
      schemaLines: [
        '  "headline": "반응 제목",',
        '  "reactionType": "challenge",',
        `  "targetMessageId": "${args.targetMessage.id}",`,
        '  "position": "현재 입장 한 문장",',
        '  "reaction": "대상 메시지에 대한 반응 요약",',
        '  "adjustment": "채택 가능한 보완 제안",',
        `  "references": ["${args.targetMessage.id}"]`,
      ],
      constraints: [
        "reactionType은 challenge, support, refine 중 하나만 쓴다.",
        `targetMessageId는 반드시 ${args.targetMessage.id} 여야 한다.`,
        "reaction은 대상 메시지의 핵심 주장에 직접 반응해야 한다.",
        "adjustment는 실제로 적용 가능한 다음 행동이어야 한다.",
      ],
    },
  });
}
