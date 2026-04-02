import type { ChatMessage } from "../types/chat.js";
import type { BackendDiscussion, PMFinalDecision } from "../types/contracts.js";
import { KOREAN_OUTPUT_RULE, renderDiscussionContext } from "./shared.js";

export function buildBackendDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 구조화된 멀티 에이전트 협업 방의 백엔드 에이전트다.",
      "API 설계, 데이터 모델 구조, 기술 제약을 구체화하는 역할을 맡는다.",
      "응답 전에 모든 이전 메시지를 읽어라.",
      "유효한 JSON만 반환하고 references에 근거가 된 메시지 ID를 적어라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "headline": "짧은 백엔드 관점 제목",',
      '  "summary": "간결한 백엔드 요약",',
      '  "apiDesign": ["엔드포인트 또는 서비스 아이디어 1", "아이디어 2", "아이디어 3"],',
      '  "dataModel": ["엔터티 또는 테이블 아이디어 1", "아이디어 2"],',
      '  "constraints": ["제약 1", "제약 2"],',
      '  "references": ["msg-001", "msg-002"]',
      "}",
      "",
      "제약 조건:",
      "- apiDesign는 3개 이상 6개 이하",
      "- dataModel은 2개 이상 5개 이하",
      "- constraints는 2개 이상 5개 이하",
      "- references는 응답 근거가 된 대화 기록 ID를 가리켜야 함",
    ].join("\n"),
  };
}

export function buildBackendSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendDiscussion: BackendDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "당신은 최종 백엔드 구현 산출물을 생성하는 백엔드 에이전트다.",
      "PM의 최종 결정에 엄격하게 맞춰라.",
      "구체적인 API, 데이터 구조, 구현 가이드를 제시하라.",
      "유효한 JSON만 반환하라.",
      KOREAN_OUTPUT_RULE,
    ].join(" "),
    userPrompt: [
      `사용자 요청: ${args.userRequest}`,
      `PM 최종 결정: ${args.finalDecision.finalDecision}`,
      `PM MVP 범위: ${args.finalDecision.mvpScope.join("; ")}`,
      `백엔드 논의 요약: ${args.backendDiscussion.summary}`,
      `백엔드 제안 API: ${args.backendDiscussion.apiDesign.join("; ")}`,
      `백엔드 데이터 모델 메모: ${args.backendDiscussion.dataModel.join("; ")}`,
      `백엔드 제약 사항: ${args.backendDiscussion.constraints.join("; ")}`,
      "",
      "반드시 아래 키만 포함한 JSON을 반환하라:",
      "{",
      '  "overview": "간결한 한 단락 개요",',
      '  "apiDesign": ["엔드포인트 1", "엔드포인트 2", "엔드포인트 3"],',
      '  "dataModel": ["스키마 항목 1", "스키마 항목 2", "스키마 항목 3"],',
      '  "constraints": ["제약 1", "제약 2"],',
      '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
      '  "exampleCode": {',
      '    "language": "ts",',
      '    "snippet": "코드 예시"',
      "  }",
      "}",
      "",
      "제약 조건:",
      "- apiDesign, dataModel, implementationSteps는 구체적이어야 함",
      "- exampleCode는 제안한 백엔드 구조와 직접 연결되어야 함",
      "- PM MVP 범위 밖의 기능은 추가하지 말 것",
    ].join("\n"),
  };
}
