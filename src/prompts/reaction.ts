import type { AgentRole, ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

const ROLE_OBJECTIVES: Record<Exclude<AgentRole, "pm">, { objective: string; responsibilities: string[] }> = {
  backend: {
    objective: "지정된 메시지에 대한 백엔드 관점의 반응과 보완 제안을 작성한다.",
    responsibilities: [
      "API, 데이터 구조, 권한, 상태 관리 관점에서 빈틈을 지적한다.",
      "구현 경계와 파일 책임이 드러나는 보완안을 남긴다.",
    ],
  },
  frontend: {
    objective: "지정된 메시지에 대한 프론트엔드 관점의 반응과 보완 제안을 작성한다.",
    responsibilities: [
      "사용자 흐름, 화면 구조, 상호작용 관점에서 문제를 짚는다.",
      "다음 단계에서 바로 화면 설계로 이어질 보완안을 남긴다.",
    ],
  },
  ai: {
    objective: "지정된 메시지에 대한 AI 관점의 반응과 보완 제안을 작성한다.",
    responsibilities: [
      "실현 가능성, 정확도 한계, 가드레일 관점에서 검토한다.",
      "자동화 위험이 크면 분명하게 경고한다.",
    ],
  },
  infra: {
    objective: "지정된 메시지에 대한 인프라 관점의 반응과 보완 제안을 작성한다.",
    responsibilities: [
      "배포 구조, 환경 분리, 운영 안정성 관점에서 빠진 점을 찾는다.",
      "실행 명령, 환경 변수, 배포 노트로 이어질 보완안을 남긴다.",
    ],
  },
  test: {
    objective: "지정된 메시지에 대한 테스트 관점의 반응과 보완 제안을 작성한다.",
    responsibilities: [
      "실행 검증, 계약 검증, 회귀 방지 관점에서 빠진 점을 짚는다.",
      "바로 코드 리뷰나 smoke test로 이어질 수 있는 보완안을 남긴다.",
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
        title: "Target Message",
        lines: [
          `Target ID: ${args.targetMessage.id}`,
          `Speaker: ${args.targetMessage.speaker}`,
          "Body:",
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
        "reactionType은 challenge, support, refine 중 하나다.",
        `targetMessageId는 반드시 ${args.targetMessage.id} 여야 한다.`,
        "reaction은 대상 메시지의 핵심 주장에 직접 반응해야 한다.",
        "adjustment는 다음 단계에서 바로 실행 가능한 후속 행동이어야 한다.",
      ],
    },
  });
}
