import type { ChatMessage } from "../types/chat.js";
import type { PMFinalDecision, TestDiscussion } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildTestDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "test",
    mode: "discussion",
    objective: "검증 전략, 품질 리스크, 테스트 우선순위를 기준으로 핵심 주장을 정리한다.",
    responsibilities: [
      "무엇을 먼저 검증해야 하는지, 어떤 실패가 가장 치명적인지 명확히 말한다.",
      "실제 테스트 파일과 스모크 체크로 이어질 수 있는 수준으로 구체화한다.",
      "다른 역할의 제안이 실행은 되더라도 검증이 빈약하면 분명하게 지적한다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "테스트 관점 제목",',
        '  "summary": "테스트 관점 요약",',
        '  "claim": "핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-002",',
        '  "rebuttal": "반박 또는 보완 설명",',
        '  "testApproach": ["전략 1", "전략 2", "전략 3"],',
        '  "coverageFocus": ["커버리지 포인트 1", "커버리지 포인트 2"],',
        '  "qualityRisks": ["리스크 1", "리스크 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하로 작성한다.",
        "testApproach는 3개 이상 6개 이하로 작성한다.",
        "coverageFocus와 qualityRisks는 각각 2개 이상 5개 이하로 작성한다.",
        "반박 대상이 없으면 rebuttalTarget은 '없음'으로 쓴다.",
      ],
    },
  });
}

export function buildTestSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  testDiscussion: TestDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "test",
    mode: "artifact",
    objective: "PM 최종 결정과 테스트 토론을 기준으로 실행 가능한 테스트 명세를 완성한다.",
    responsibilities: [
      "테스트 전략, 핵심 시나리오, 품질 게이트를 실제 검증 단계로 정리한다.",
      "코드 생성 뒤 바로 실행할 수 있는 smoke test와 contract test를 우선한다.",
      "예시 코드는 실제 테스트 파일 구조나 실행 흐름과 연결되어야 한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM Final Decision", lines: [args.finalDecision.finalDecision] },
      { title: "MVP Scope", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "Test Summary", lines: [args.testDiscussion.summary] },
      { title: "Core Claim", lines: [`- ${args.testDiscussion.claim}`] },
      { title: "Test Approach", lines: args.testDiscussion.testApproach.map((item) => `- ${item}`) },
      { title: "Coverage Focus", lines: args.testDiscussion.coverageFocus.map((item) => `- ${item}`) },
      { title: "Quality Risks", lines: args.testDiscussion.qualityRisks.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "테스트 명세 개요",',
        '  "testStrategy": ["전략 1", "전략 2", "전략 3"],',
        '  "testScenarios": ["시나리오 1", "시나리오 2", "시나리오 3"],',
        '  "qualityGates": ["게이트 1", "게이트 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "js",',
        '    "snippet": "예시 테스트 코드"',
        "  }",
      ],
      constraints: [
        "testStrategy, testScenarios, implementationSteps는 3개 이상 작성한다.",
        "qualityGates는 2개 이상 작성한다.",
        "예시 코드는 smoke test나 contract test 형태로 바로 이해 가능해야 한다.",
      ],
    },
  });
}
