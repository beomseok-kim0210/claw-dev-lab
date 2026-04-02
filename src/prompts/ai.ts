import type { ChatMessage } from "../types/chat.js";
import type { AIDiscussion, PMFinalDecision } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildAIDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "ai",
    mode: "discussion",
    objective: "qwen3 기반 MVP에서 실현 가능한 AI 기능과 위험 요소를 정리한다.",
    responsibilities: [
      "AI 기능을 과장하지 않고 현실적인 수준으로 제안한다.",
      "실현 가능성과 리스크를 함께 균형 있게 적는다.",
      "백엔드와 프론트엔드가 바로 이어받을 수 있는 연동 포인트를 드러낸다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 AI 관점 제목",',
        '  "summary": "간결한 AI 요약",',
        '  "aiFeatures": ["기능 1", "기능 2", "기능 3"],',
        '  "feasibility": ["실현 가능성 메모 1", "메모 2"],',
        '  "risks": ["위험 1", "위험 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "aiFeatures는 3개 이상 6개 이하",
        "feasibility와 risks는 각각 2개 이상 5개 이하",
        "references는 응답 근거가 된 대화 기록 ID를 가리켜야 함",
        "제안은 qwen3 기반 MVP에서 실현 가능한 수준으로 유지",
      ],
    },
  });
}

export function buildAIFeaturesSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  aiDiscussion: AIDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "ai",
    mode: "artifact",
    objective: "PM 최종 결정을 기준으로 AI 기능 명세와 가드레일을 완성한다.",
    responsibilities: [
      "AI 기능을 구체적인 통합 포인트와 함께 정리한다.",
      "실현 가능성과 가드레일을 빠뜨리지 않는다.",
      "예시 코드는 실제 AI 연동 흐름을 드러내야 한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "PM MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "AI 논의 요약", lines: [args.aiDiscussion.summary] },
      { title: "AI 기능", lines: args.aiDiscussion.aiFeatures.map((item) => `- ${item}`) },
      { title: "AI 실현 가능성", lines: args.aiDiscussion.feasibility.map((item) => `- ${item}`) },
      { title: "AI 위험 요소", lines: args.aiDiscussion.risks.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "간결한 한 단락 개요",',
        '  "features": ["기능 1", "기능 2", "기능 3"],',
        '  "feasibilityNotes": ["메모 1", "메모 2"],',
        '  "guardrails": ["가드레일 1", "가드레일 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "ts",',
        '    "snippet": "코드 예시"',
        "  }",
      ],
      constraints: [
        "features는 단일 qwen3 기반 MVP에서 현실적이어야 함",
        "guardrails는 신뢰성 또는 안전성 이슈를 다뤄야 함",
        "exampleCode는 일반 UI 코드가 아니라 AI 연동 방식을 보여줘야 함",
      ],
    },
  });
}
