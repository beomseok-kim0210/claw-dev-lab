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
    objective: "백엔드 관점에서 API, 데이터 구조, 상태 관리의 핵심 주장을 정리한다.",
    responsibilities: [
      "API와 데이터 모델이 MVP를 어떻게 지탱하는지 설명한다.",
      "기존 발언과 충돌하거나 빠진 서버 측 제약을 분명히 짚는다.",
      "토론 이후 바로 명세로 옮길 수 있는 제안을 남긴다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "백엔드 관점 제목",',
        '  "summary": "백엔드 관점 요약",',
        '  "claim": "핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-002",',
        '  "rebuttal": "반박 또는 보완 설명",',
        '  "apiDesign": ["API 1", "API 2", "API 3"],',
        '  "dataModel": ["모델 1", "모델 2"],',
        '  "constraints": ["제약 1", "제약 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하로 작성한다.",
        "apiDesign은 3개 이상 6개 이하로 작성한다.",
        "dataModel과 constraints는 각각 2개 이상 5개 이하로 작성한다.",
        "반박 대상이 없으면 rebuttalTarget에 '없음'을 넣는다.",
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
      "최종 API 구조와 데이터 모델을 바로 구현할 수 있는 수준으로 정리한다.",
      "기술 제약과 검증 포인트를 분명히 적는다.",
      "예시 코드가 실제 서버 구조와 연결되게 쓴다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "백엔드 요약", lines: [args.backendDiscussion.summary] },
      { title: "핵심 주장", lines: [`- ${args.backendDiscussion.claim}`] },
      { title: "API 제안", lines: args.backendDiscussion.apiDesign.map((item) => `- ${item}`) },
      { title: "데이터 모델 제안", lines: args.backendDiscussion.dataModel.map((item) => `- ${item}`) },
      { title: "제약 사항", lines: args.backendDiscussion.constraints.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "백엔드 개요",',
        '  "apiDesign": ["API 설계 1", "API 설계 2", "API 설계 3"],',
        '  "dataModel": ["데이터 모델 1", "데이터 모델 2", "데이터 모델 3"],',
        '  "constraints": ["제약 1", "제약 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "ts",',
        '    "snippet": "예시 코드"',
        "  }",
      ],
      constraints: [
        "apiDesign, dataModel, implementationSteps는 모두 3개 이상으로 작성한다.",
        "exampleCode는 실제 백엔드 구현 구조와 직접 연결되어야 한다.",
        "PM이 확정하지 않은 기능을 임의로 추가하지 않는다.",
      ],
    },
  });
}
