import type { ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildPmInitialPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "discussion",
    objective: "제품 문제를 정의하고 현실적인 MVP 프레임을 먼저 고정한다.",
    responsibilities: [
      "사용자 요청을 제품 문제와 목표로 재구성한다.",
      "나머지 에이전트가 과도하게 범위를 넓히지 않도록 초기 기준선을 세운다.",
      "성공 기준을 구현 관점에서 측정 가능한 형태로 적는다.",
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
        "references는 대화 기록에 있는 ID만 사용",
        "범위는 실제 구현 관점으로 유지",
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
    objective: "한 번의 토론 라운드를 정리해 하나의 MVP 방향을 최종 확정한다.",
    responsibilities: [
      "에이전트 의견을 종합해 충돌을 해소한다.",
      "반드시 하나의 실행 가능한 방향으로 결론을 내린다.",
      "이번 단계에서 하지 않을 범위를 명확하게 잘라낸다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 최종 결정 제목",',
        '  "summary": "합의를 요약하는 한 단락",',
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
        "references는 결정에 가장 큰 영향을 준 메시지를 인용",
      ],
    },
  });
}
