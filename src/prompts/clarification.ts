import type { ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildClarificationPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "discussion",
    objective: "구현을 막는 모호함이 있는지 판단하고, 정말 필요한 사용자 질문만 뽑아낸다.",
    responsibilities: [
      "지금 답이 없으면 API, 데이터, 테스트, 인프라, UI 구조가 흔들리는 질문만 고른다.",
      "질문은 최대 3개까지만 만든다.",
      "합리적 가정으로 충분한 내용은 질문으로 올리지 않는다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "needsInput": true,',
        '  "summary": "왜 확인이 필요한지 요약",',
        '  "questions": [',
        "    {",
        '      "id": "clarify-01",',
        '      "askedBy": "backend",',
        '      "topic": "api",',
        '      "question": "사용자가 원하는 핵심 API는 무엇인가요?",',
        '      "reason": "API 범위를 정해야 서버 구조를 고정할 수 있습니다."',
        "    }",
        "  ]",
      ],
      constraints: [
        "질문은 최대 3개까지만 작성한다.",
        "questions가 비어 있으면 needsInput은 false여야 한다.",
        "각 질문은 지금 답이 없으면 구현이 흔들리는 내용이어야 한다.",
      ],
    },
  });
}
