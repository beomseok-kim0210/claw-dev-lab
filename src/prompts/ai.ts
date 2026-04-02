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
    objective: "AI 관점의 핵심 주장과 실현 가능성 기반 반박을 분명하게 제시한다.",
    responsibilities: [
      "qwen3 기반 MVP에서 가능한 범위를 현실적으로 제안한다.",
      "과한 자동화나 불안정한 제안이 보이면 반박한다.",
      "기능 제안과 함께 위험 요소와 보완책을 같이 적는다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "짧은 AI 관점 제목",',
        '  "summary": "간결한 AI 요약",',
        '  "claim": "AI 관점의 핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-004",',
        '  "rebuttal": "특정 메시지에 대한 반박 또는 보완 설명",',
        '  "aiFeatures": ["기능 1", "기능 2", "기능 3"],',
        '  "feasibility": ["실현 가능성 메모 1", "메모 2"],',
        '  "risks": ["위험 1", "위험 2"],',
        '  "references": ["msg-001", "msg-004"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하",
        "aiFeatures는 3개 이상 6개 이하",
        "feasibility와 risks는 각각 2개 이상 5개 이하",
        "반박할 대상이 없다면 rebuttalTarget은 '없음'으로 작성",
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
      "예시 코드는 실제 AI 연동 흐름을 보여줘야 한다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "PM MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "AI 토론 요약", lines: [args.aiDiscussion.summary] },
      { title: "AI 핵심 주장", lines: [`- ${args.aiDiscussion.claim}`] },
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
        "features는 단일 qwen3 기반 MVP에서 현실적이어야 한다",
        "guardrails는 신뢰성 또는 안전성 이슈를 다뤄야 한다",
        "exampleCode는 일반 UI 코드가 아니라 AI 연동 방식을 보여줘야 한다",
      ],
    },
  });
}
