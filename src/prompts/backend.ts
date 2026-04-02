import type { ChatMessage } from "../types/chat.js";
import type { BackendDiscussion, PMFinalDecision } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildBackendDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "backend",
    mode: "discussion",
    objective: "MVP를 구현하기 위한 API, 데이터 모델, 기술 제약을 정리한다.",
    responsibilities: [
      "백엔드 관점에서 필요한 인터페이스와 저장 구조를 제안한다.",
      "성능, 권한, 저장 방식 같은 제약을 빠뜨리지 않는다.",
      "프론트엔드와 AI 연동이 가능한 수준으로 구조를 구체화한다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 백엔드 관점 제목",',
        '  "summary": "간결한 백엔드 요약",',
        '  "apiDesign": ["엔드포인트 또는 서비스 아이디어 1", "아이디어 2", "아이디어 3"],',
        '  "dataModel": ["엔터티 또는 테이블 아이디어 1", "아이디어 2"],',
        '  "constraints": ["제약 1", "제약 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "apiDesign는 3개 이상 6개 이하",
        "dataModel은 2개 이상 5개 이하",
        "constraints는 2개 이상 5개 이하",
        "references는 응답 근거가 된 대화 기록 ID를 가리켜야 함",
      ],
    },
  });
}

export function buildBackendSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendDiscussion: BackendDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "backend",
    mode: "artifact",
    objective: "PM 최종 결정을 기준으로 구현 가능한 백엔드 명세를 완성한다.",
    responsibilities: [
      "최종 API 구조와 데이터 모델을 구현 가능한 수준으로 구체화한다.",
      "제약과 구현 단계를 함께 제시한다.",
      "예시 코드는 실제 제안 구조와 직접 연결되도록 작성한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "PM MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "백엔드 논의 요약", lines: [args.backendDiscussion.summary] },
      { title: "백엔드 제안 API", lines: args.backendDiscussion.apiDesign.map((item) => `- ${item}`) },
      { title: "백엔드 데이터 모델 메모", lines: args.backendDiscussion.dataModel.map((item) => `- ${item}`) },
      { title: "백엔드 제약 사항", lines: args.backendDiscussion.constraints.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "간결한 한 단락 개요",',
        '  "apiDesign": ["엔드포인트 1", "엔드포인트 2", "엔드포인트 3"],',
        '  "dataModel": ["스키마 항목 1", "스키마 항목 2", "스키마 항목 3"],',
        '  "constraints": ["제약 1", "제약 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "ts",',
        '    "snippet": "코드 예시"',
        "  }",
      ],
      constraints: [
        "apiDesign, dataModel, implementationSteps는 구체적이어야 함",
        "exampleCode는 제안한 백엔드 구조와 직접 연결되어야 함",
        "PM MVP 범위 밖의 기능은 추가하지 말 것",
      ],
    },
  });
}
