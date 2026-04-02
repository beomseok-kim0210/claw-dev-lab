import type { ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildPmInitialPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "discussion",
    objective: "사용자 요청을 팀이 바로 토론할 수 있는 문제 정의와 MVP 기준으로 압축한다.",
    responsibilities: [
      "사용자 요청을 제품 문제, 사용자 가치, MVP 목표로 분리한다.",
      "중간 토론에서 벗어나지 않도록 범위 기준을 선명하게 고정한다.",
      "성공 기준을 구현 가능한 수준으로 적는다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "초기 PM 정리 제목",',
        '  "problemStatement": "한 문단의 문제 정의",',
        '  "mvpGoals": ["목표 1", "목표 2"],',
        '  "successCriteria": ["기준 1", "기준 2"],',
        '  "references": ["msg-001"]',
      ],
      constraints: [
        "mvpGoals는 2개 이상 5개 이하로 작성한다.",
        "successCriteria는 2개 이상 5개 이하로 작성한다.",
        "references는 실제 대화에 있는 메시지 ID만 사용한다.",
      ],
    },
  });
}

export function buildPmFinalPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "discussion",
    objective: "자유 토론과 사용자 추가 답변을 정리해 하나의 MVP 방향으로 결론낸다.",
    responsibilities: [
      "백엔드, 프론트엔드, AI, 인프라 관점을 모두 요약한다.",
      "충돌이 있으면 왜 특정 방향을 채택했는지 결정문에 반영한다.",
      "바로 구현 가능한 범위와 제외 범위를 분리한다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "최종 PM 결정 제목",',
        '  "summary": "토론 합의 요약",',
        '  "mvpScope": ["범위 1", "범위 2", "범위 3"],',
        '  "nonGoals": ["제외 1", "제외 2"],',
        '  "deliveryPlan": ["단계 1", "단계 2", "단계 3"],',
        '  "finalDecision": "최종 결정 한 문장",',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "mvpScope는 3개 이상 6개 이하로 작성한다.",
        "nonGoals는 2개 이상 5개 이하로 작성한다.",
        "deliveryPlan은 3개 이상 6개 이하로 작성한다.",
        "references에는 결정에 직접 영향을 준 메시지를 포함한다.",
      ],
    },
  });
}
