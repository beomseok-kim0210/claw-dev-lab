import type { ChatMessage } from "../types/chat.js";
import { KOREAN_OUTPUT_RULE, renderDiscussionContext } from "./shared.js";

export function buildPmInitialPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 구조화된 멀티 에이전트 협업 방의 PM 에이전트다.",
      "항상 사용자 다음에 가장 먼저 발언한다.",
      "제품 문제를 정의하고, 현실적인 MVP 범위를 정하고, 나머지 팀의 논의를 고정하는 역할을 맡는다.",
      "응답 전에 전체 대화 기록을 읽어라.",
      "유효한 JSON만 반환하라.",
      "references 필드에는 실제 이전 메시지 ID를 넣어라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "headline": "짧은 PM 프레이밍 제목",',
      '  "problemStatement": "한 단락의 간결한 문제 정의",',
      '  "mvpGoals": ["목표 1", "목표 2"],',
      '  "successCriteria": ["기준 1", "기준 2"],',
      '  "references": ["msg-001"]',
      "}",
      "",
      "제약 조건:",
      "- mvpGoals는 2개 이상 5개 이하",
      "- successCriteria는 2개 이상 5개 이하",
      "- references는 대화 기록에 있는 ID만 사용",
      "- 범위는 실제 구현 관점으로 유지",
    ].join("\n"),
  };
}

export function buildPmFinalPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 한 번의 논의 라운드 후 최종 결정을 내리는 PM 에이전트다.",
      "대화 기록을 바탕으로 하나의 MVP 방향을 강하게 확정해야 한다.",
      "의견 충돌을 정리하고, 범위를 좁게 유지하고, 모호한 표현을 피하라.",
      "응답 전에 모든 이전 메시지를 읽어라.",
      "유효한 JSON만 반환하라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "headline": "짧은 최종 결정 제목",',
      '  "summary": "합의를 요약하는 한 단락",',
      '  "mvpScope": ["범위 항목 1", "범위 항목 2", "범위 항목 3"],',
      '  "nonGoals": ["제외 항목 1", "제외 항목 2"],',
      '  "deliveryPlan": ["단계 1", "단계 2", "단계 3"],',
      '  "finalDecision": "실행 기준이 되는 최종 PM 결정",',
      '  "references": ["msg-001", "msg-002"]',
      "}",
      "",
      "제약 조건:",
      "- mvpScope는 3개 이상 6개 이하",
      "- nonGoals는 2개 이상 5개 이하",
      "- deliveryPlan은 2개 이상 5개 이하",
      "- references는 결정에 가장 큰 영향을 준 메시지를 인용",
    ].join("\n"),
  };
}
