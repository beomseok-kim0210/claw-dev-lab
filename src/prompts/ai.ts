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
    objective: "AI 기능의 가치, 실현 가능성, 가드레일 관점에서 핵심 주장을 정리한다.",
    responsibilities: [
      "AI가 맡아야 할 기능과 인간 검토가 필요한 경계를 분명히 한다.",
      "실현 가능성과 위험 요소를 숨기지 않는다.",
      "토론 결과가 실제 AI 모듈 설계로 이어지도록 쓴다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "AI 관점 제목",',
        '  "summary": "AI 관점 요약",',
        '  "claim": "핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-002",',
        '  "rebuttal": "반박 또는 보완 설명",',
        '  "aiFeatures": ["기능 1", "기능 2", "기능 3"],',
        '  "feasibility": ["실현 가능성 1", "실현 가능성 2"],',
        '  "risks": ["위험 1", "위험 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하로 작성한다.",
        "aiFeatures는 3개 이상 6개 이하로 작성한다.",
        "feasibility와 risks는 각각 2개 이상 5개 이하로 작성한다.",
        "반박 대상이 없으면 rebuttalTarget에 '없음'을 넣는다.",
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
    objective: "PM 최종 결정을 기준으로 AI 기능 명세를 완성한다.",
    responsibilities: [
      "AI 기능, 가드레일, 검증 포인트를 실제 구현 단위로 정리한다.",
      "실현 가능성과 한계를 함께 적는다.",
      "예시 코드가 실제 AI 모듈 흐름을 보여주도록 쓴다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "AI 요약", lines: [args.aiDiscussion.summary] },
      { title: "핵심 주장", lines: [`- ${args.aiDiscussion.claim}`] },
      { title: "AI 기능 제안", lines: args.aiDiscussion.aiFeatures.map((item) => `- ${item}`) },
      { title: "실현 가능성", lines: args.aiDiscussion.feasibility.map((item) => `- ${item}`) },
      { title: "위험 요소", lines: args.aiDiscussion.risks.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "AI 기능 개요",',
        '  "features": ["기능 1", "기능 2", "기능 3"],',
        '  "feasibilityNotes": ["메모 1", "메모 2"],',
        '  "guardrails": ["가드레일 1", "가드레일 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "ts",',
        '    "snippet": "예시 코드"',
        "  }",
      ],
      constraints: [
        "features와 implementationSteps는 3개 이상 작성한다.",
        "feasibilityNotes와 guardrails는 2개 이상 작성한다.",
        "가드레일은 실제 운영에서 체크할 수 있는 문장이어야 한다.",
      ],
    },
  });
}
