import type { AgentRole, ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

const ROLE_OBJECTIVES: Record<AgentRole, { objective: string; responsibilities: string[] }> = {
  pm: {
    objective: "토론 흐름을 조정한다.",
    responsibilities: ["PM 반응 프롬프트는 직접 사용하지 않는다."],
  },
  backend: {
    objective: "지정된 메시지에 대해 백엔드 관점의 반응과 보완 제안을 남긴다.",
    responsibilities: [
      "API, 데이터 구조, 권한, 저장 방식 관점에서 무엇이 문제인지 짚는다.",
      "찬성하더라도 구체적인 보완 조건을 덧붙인다.",
    ],
  },
  frontend: {
    objective: "지정된 메시지에 대해 프론트엔드 관점의 반응과 보완 제안을 남긴다.",
    responsibilities: [
      "사용자 흐름, 화면 구조, 사용성 관점에서 무엇이 문제인지 짚는다.",
      "찬성하더라도 실제 UI에 반영할 보완 조건을 덧붙인다.",
    ],
  },
  ai: {
    objective: "지정된 메시지에 대해 AI 관점의 반응과 보완 제안을 남긴다.",
    responsibilities: [
      "실현 가능성, 신뢰성, 가드레일 관점에서 무엇이 문제인지 짚는다.",
      "찬성하더라도 모델 한계나 안전 조건을 함께 제시한다.",
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
        title: "이번에 반드시 반응해야 할 대상 메시지",
        lines: [
          `대상 ID: ${args.targetMessage.id}`,
          `발화자: ${args.targetMessage.speaker}`,
          "원문:",
          args.targetMessage.content,
        ],
      },
    ],
    contract: {
      schemaLines: [
        '  "headline": "짧은 반응 제목",',
        '  "reactionType": "challenge",',
        `  "targetMessageId": "${args.targetMessage.id}",`,
        '  "position": "현재 입장 한 문장",',
        '  "reaction": "대상 메시지에 대한 반응 한 단락",',
        '  "adjustment": "팀이 채택할 보완 제안",',
        `  "references": ["${args.targetMessage.id}"]`,
      ],
      constraints: [
        "reactionType은 challenge, support, refine 중 하나만 사용",
        `targetMessageId는 반드시 ${args.targetMessage.id} 로 작성`,
        "reaction은 대상 메시지의 주장에 직접 반응해야 한다",
        "adjustment는 실제로 채택 가능한 수정 방향이어야 한다",
      ],
    },
  });
}
