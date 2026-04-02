import type { ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildPmInitialPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "discussion",
    objective: "제품 문제를 정의하고 토론에서 다뤄야 할 핵심 쟁점을 먼저 고정한다.",
    responsibilities: [
      "사용자 요청을 제품 문제와 MVP 목표로 재구성한다.",
      "중간 토론에서 다뤄야 할 기준선을 명확히 세운다.",
      "토론이 퍼지지 않도록 성공 기준을 구체적으로 적는다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 PM 프레이밍 제목",',
        '  "problemStatement": "한 단락의 간결한 문제 정의",',
        '  "mvpGoals": ["목표 1", "목표 2"],',
        '  "successCriteria": ["기준 1", "기준 2"],',
        '  "references": ["msg-001"]',
      ],
      constraints: [
        "mvpGoals는 2개 이상 5개 이하",
        "successCriteria는 2개 이상 5개 이하",
        "references는 실제로 영향을 준 메시지 ID만 사용",
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
    objective: "자유 토론을 정리하고 하나의 MVP 방향으로 최종 결론을 내린다.",
    responsibilities: [
      "에이전트들의 주장과 반박을 정리한다.",
      "충돌이 있으면 왜 한쪽을 채택했는지 결정문에 반영한다.",
      "바로 구현 가능한 범위와 제외 범위를 분명하게 나눈다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 최종 결정 제목",',
        '  "summary": "토론 합의를 요약하는 한 단락",',
        '  "mvpScope": ["범위 항목 1", "범위 항목 2", "범위 항목 3"],',
        '  "nonGoals": ["제외 항목 1", "제외 항목 2"],',
        '  "deliveryPlan": ["단계 1", "단계 2", "단계 3"],',
        '  "finalDecision": "실행 기준이 되는 최종 PM 결정",',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "mvpScope는 3개 이상 6개 이하",
        "nonGoals는 2개 이상 5개 이하",
        "deliveryPlan은 2개 이상 5개 이하",
        "references는 최종 결론에 가장 큰 영향을 준 메시지를 포함",
      ],
    },
  });
}
