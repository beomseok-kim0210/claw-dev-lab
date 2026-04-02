import type { ChatMessage } from "../types/chat.js";
import type { AIDiscussion, PMFinalDecision } from "../types/contracts.js";
import { KOREAN_OUTPUT_RULE, renderDiscussionContext } from "./shared.js";

export function buildAIDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 구조화된 멀티 에이전트 협업 방의 AI 전문가다.",
      "AI 기능 제안, 실현 가능성 평가, 위험 식별을 맡는다.",
      "응답 전에 모든 이전 메시지를 읽어라.",
      "유효한 JSON만 반환하고 references에 근거가 된 메시지 ID를 적어라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "headline": "짧은 AI 관점 제목",',
      '  "summary": "간결한 AI 요약",',
      '  "aiFeatures": ["기능 1", "기능 2", "기능 3"],',
      '  "feasibility": ["실현 가능성 메모 1", "메모 2"],',
      '  "risks": ["위험 1", "위험 2"],',
      '  "references": ["msg-001", "msg-002"]',
      "}",
      "",
      "제약 조건:",
      "- aiFeatures는 3개 이상 6개 이하",
      "- feasibility와 risks는 각각 2개 이상 5개 이하",
      "- references는 응답 근거가 된 대화 기록 ID를 가리켜야 함",
      "- 제안은 qwen3 기반 MVP에서 실현 가능한 수준으로 유지",
    ].join("\n"),
  };
}

export function buildAIFeaturesSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  aiDiscussion: AIDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 최종 AI 구현 산출물을 생성하는 AI 전문가다.",
      "PM의 최종 결정에 엄격하게 맞춰라.",
      "실현 가능한 AI 기능, 가드레일, 통합 지점에 집중하라.",
      "유효한 JSON만 반환하라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      `사용자 요청: ${args.userRequest}`,
      `PM 최종 결정: ${args.finalDecision.finalDecision}`,
      `PM MVP 범위: ${args.finalDecision.mvpScope.join("; ")}`,
      `AI 논의 요약: ${args.aiDiscussion.summary}`,
      `AI 기능: ${args.aiDiscussion.aiFeatures.join("; ")}`,
      `AI 실현 가능성: ${args.aiDiscussion.feasibility.join("; ")}`,
      `AI 위험 요소: ${args.aiDiscussion.risks.join("; ")}`,
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "overview": "간결한 한 단락 개요",',
      '  "features": ["기능 1", "기능 2", "기능 3"],',
      '  "feasibilityNotes": ["메모 1", "메모 2"],',
      '  "guardrails": ["가드레일 1", "가드레일 2"],',
      '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
      '  "exampleCode": {',
      '    "language": "ts",',
      '    "snippet": "코드 예시"',
      "  }",
      "}",
      "",
      "제약 조건:",
      "- features는 단일 qwen3 기반 MVP에서 현실적이어야 함",
      "- guardrails는 신뢰성 또는 안전성 이슈를 다뤄야 함",
      "- exampleCode는 일반 UI 코드가 아니라 AI 연동 방식을 보여줘야 함",
    ].join("\n"),
  };
}
