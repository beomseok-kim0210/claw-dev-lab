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
    objective: "백엔드 관점의 핵심 주장과 반박 포인트를 명확히 제시한다.",
    responsibilities: [
      "API와 데이터 구조 관점에서 MVP 구현 방향을 제안한다.",
      "대화 기록 속 다른 주장과 충돌하는 지점을 숨기지 않는다.",
      "반박이 있다면 왜 백엔드 관점에서 문제가 되는지 설명한다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 백엔드 관점 제목",',
        '  "summary": "간결한 백엔드 요약",',
        '  "claim": "백엔드의 핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-002",',
        '  "rebuttal": "특정 메시지에 대한 반박 또는 보완 설명",',
        '  "apiDesign": ["API 1", "API 2", "API 3"],',
        '  "dataModel": ["모델 1", "모델 2"],',
        '  "constraints": ["제약 1", "제약 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하",
        "apiDesign는 3개 이상 6개 이하",
        "dataModel과 constraints는 각각 2개 이상 5개 이하",
        "반박할 대상이 없다면 rebuttalTarget은 '없음'으로 작성",
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
      "최종 API 구조와 데이터 모델을 실제 구현 관점으로 정리한다.",
      "기술 제약과 구현 순서를 함께 제공한다.",
      "예시 코드는 제안한 구조와 직접 연결되게 작성한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "PM MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "백엔드 토론 요약", lines: [args.backendDiscussion.summary] },
      { title: "백엔드 핵심 주장", lines: [`- ${args.backendDiscussion.claim}`] },
      { title: "백엔드 API 제안", lines: args.backendDiscussion.apiDesign.map((item) => `- ${item}`) },
      { title: "백엔드 데이터 모델", lines: args.backendDiscussion.dataModel.map((item) => `- ${item}`) },
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
        "apiDesign, dataModel, implementationSteps는 구체적이어야 한다",
        "exampleCode는 제안한 백엔드 구조와 직접 연결되어야 한다",
        "PM MVP 범위 밖의 기능은 추가하지 않는다",
      ],
    },
  });
}
