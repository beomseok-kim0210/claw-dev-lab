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
    objective: "MVP에 필요한 화면 구조, 컴포넌트 경계, 사용성 포인트를 정리한다.",
    responsibilities: [
      "사용자 흐름을 기준으로 화면 단위를 제안한다.",
      "구현 가능한 컴포넌트 구조와 상호작용 포인트를 정리한다.",
      "토론 단계에서 사용성 리스크를 미리 드러낸다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 프론트엔드 관점 제목",',
        '  "summary": "간결한 프론트엔드 요약",',
        '  "screens": ["화면 1", "화면 2", "화면 3"],',
        '  "components": ["컴포넌트 1", "컴포넌트 2", "컴포넌트 3"],',
        '  "usabilityNotes": ["메모 1", "메모 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "screens와 components는 각각 3개 이상 6개 이하",
        "usabilityNotes는 2개 이상 5개 이하",
        "references는 응답 근거가 된 대화 기록 ID를 가리켜야 함",
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
      "최종 화면 구조와 컴포넌트 경계를 명확히 한다.",
      "사용성 체크리스트와 구현 순서를 함께 제공한다.",
      "예시 코드는 실제 UI 구조를 바로 이해할 수 있게 작성한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "PM MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "프론트엔드 논의 요약", lines: [args.frontendDiscussion.summary] },
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
        "exampleCode는 컴포넌트 구조를 보여줘야 함",
        "범위는 PM MVP 결정 안으로 제한",
        "화려함보다 명확성과 사용성을 우선",
      ],
    },
  });
}
