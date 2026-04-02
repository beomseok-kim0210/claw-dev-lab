import type { ChatMessage } from "../types/chat.js";
import type { FrontendDiscussion, PMFinalDecision } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildFrontendDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "frontend",
    mode: "discussion",
    objective: "프론트엔드 관점의 핵심 주장과 다른 주장에 대한 반박을 분명하게 제시한다.",
    responsibilities: [
      "사용자 흐름과 화면 구조를 기준으로 입장을 정리한다.",
      "다른 역할의 주장 중 UX를 해치는 부분이 있으면 반박한다.",
      "보완이 필요한 경우 대체 UI 방향을 제시한다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 프론트엔드 관점 제목",',
        '  "summary": "간결한 프론트엔드 요약",',
        '  "claim": "프론트엔드의 핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-003",',
        '  "rebuttal": "특정 메시지에 대한 반박 또는 보완 설명",',
        '  "screens": ["화면 1", "화면 2", "화면 3"],',
        '  "components": ["컴포넌트 1", "컴포넌트 2", "컴포넌트 3"],',
        '  "usabilityNotes": ["메모 1", "메모 2"],',
        '  "references": ["msg-001", "msg-003"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하",
        "screens와 components는 각각 3개 이상 6개 이하",
        "usabilityNotes는 2개 이상 5개 이하",
        "반박할 대상이 없다면 rebuttalTarget은 '없음'으로 작성",
      ],
    },
  });
}

export function buildFrontendSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "frontend",
    mode: "artifact",
    objective: "PM 최종 결정을 기준으로 프론트엔드 구현 명세를 완성한다.",
    responsibilities: [
      "화면 구조와 컴포넌트 경계를 구현 가능한 수준으로 정리한다.",
      "사용성 기준과 구현 순서를 함께 제시한다.",
      "예시 코드는 UI 구조를 빠르게 이해할 수 있게 작성한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "PM MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "프론트엔드 토론 요약", lines: [args.frontendDiscussion.summary] },
      { title: "프론트엔드 핵심 주장", lines: [`- ${args.frontendDiscussion.claim}`] },
      { title: "프론트엔드 화면 구성", lines: args.frontendDiscussion.screens.map((item) => `- ${item}`) },
      { title: "프론트엔드 컴포넌트", lines: args.frontendDiscussion.components.map((item) => `- ${item}`) },
      { title: "프론트엔드 사용성 메모", lines: args.frontendDiscussion.usabilityNotes.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "간결한 한 단락 개요",',
        '  "screens": ["화면 1", "화면 2", "화면 3"],',
        '  "components": ["컴포넌트 1", "컴포넌트 2", "컴포넌트 3"],',
        '  "usabilityChecklist": ["체크 1", "체크 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "tsx",',
        '    "snippet": "코드 예시"',
        "  }",
      ],
      constraints: [
        "exampleCode는 컴포넌트 구조를 보여줘야 한다",
        "범위는 PM MVP 결정 안으로 제한한다",
        "화려함보다 명확성과 사용성을 우선한다",
      ],
    },
  });
}
