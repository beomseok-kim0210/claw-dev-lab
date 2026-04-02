import type { ChatMessage } from "../types/chat.js";
import type { FrontendDiscussion, PMFinalDecision } from "../types/contracts.js";
import { KOREAN_OUTPUT_RULE, renderDiscussionContext } from "./shared.js";

export function buildFrontendDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 구조화된 멀티 에이전트 협업 방의 프론트엔드 에이전트다.",
      "화면 구성, 컴포넌트 계층, 사용성 결정을 정의하는 역할을 맡는다.",
      "응답 전에 모든 이전 메시지를 읽어라.",
      "유효한 JSON만 반환하고 references에 근거가 된 메시지 ID를 적어라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "headline": "짧은 프론트엔드 관점 제목",',
      '  "summary": "간결한 프론트엔드 요약",',
      '  "screens": ["화면 1", "화면 2", "화면 3"],',
      '  "components": ["컴포넌트 1", "컴포넌트 2", "컴포넌트 3"],',
      '  "usabilityNotes": ["메모 1", "메모 2"],',
      '  "references": ["msg-001", "msg-002"]',
      "}",
      "",
      "제약 조건:",
      "- screens와 components는 각각 3개 이상 6개 이하",
      "- usabilityNotes는 2개 이상 5개 이하",
      "- references는 응답 근거가 된 대화 기록 ID를 가리켜야 함",
    ].join("\n"),
  };
}

export function buildFrontendSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 최종 프론트엔드 구현 산출물을 생성하는 프론트엔드 에이전트다.",
      "PM의 최종 결정에 엄격하게 맞춰라.",
      "화면 구조, 컴포넌트 경계, 사용성에 집중하라.",
      "유효한 JSON만 반환하라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      `사용자 요청: ${args.userRequest}`,
      `PM 최종 결정: ${args.finalDecision.finalDecision}`,
      `PM MVP 범위: ${args.finalDecision.mvpScope.join("; ")}`,
      `프론트엔드 논의 요약: ${args.frontendDiscussion.summary}`,
      `프론트엔드 화면 구성: ${args.frontendDiscussion.screens.join("; ")}`,
      `프론트엔드 컴포넌트: ${args.frontendDiscussion.components.join("; ")}`,
      `프론트엔드 사용성 메모: ${args.frontendDiscussion.usabilityNotes.join("; ")}`,
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "overview": "간결한 한 단락 개요",',
      '  "screens": ["화면 1", "화면 2", "화면 3"],',
      '  "components": ["컴포넌트 1", "컴포넌트 2", "컴포넌트 3"],',
      '  "usabilityChecklist": ["체크 1", "체크 2"],',
      '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
      '  "exampleCode": {',
      '    "language": "tsx",',
      '    "snippet": "코드 예시"',
      "  }",
      "}",
      "",
      "제약 조건:",
      "- exampleCode는 컴포넌트 구조를 보여줘야 함",
      "- 범위는 PM MVP 결정 안으로 제한",
      "- 화려함보다 명확성과 사용성을 우선",
    ].join("\n"),
  };
}
