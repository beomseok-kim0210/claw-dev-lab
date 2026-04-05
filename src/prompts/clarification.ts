import type { ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildClarificationPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "discussion",
    objective: "사용자에게 반드시 물어야 하는 외부 입력이 있는지 판단한다.",
    responsibilities: [
      "정말 구현을 막는 외부 정보만 질문으로 만든다.",
      "예시는 API 키, OAuth 클라이언트 ID/시크릿, 리디렉션 도메인, 서비스 계정 파일, 실제 연동 대상 선택, 접근 권한 승인이다.",
      "아키텍처, 화면 구성, API 개수, 데이터 모델, MVP 범위 같은 설계 질문은 사용자에게 묻지 않는다. 그런 것은 에이전트들이 토론 후 결정한다.",
      "합리적인 기본 가정으로 진행 가능한 항목은 질문으로 올리지 않는다.",
      "질문은 최대 3개까지만 만든다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "needsInput": true,',
        '  "summary": "어떤 외부 입력이 필요한지 짧게 요약",',
        '  "questions": [',
        "    {",
        '      "id": "clarify-01",',
        '      "askedBy": "infra",',
        '      "topic": "credential",',
        '      "question": "DART Open API 키를 제공할 수 있나요?",',
        '      "reason": "실제 공시 데이터를 수집하려면 외부 API 자격 정보가 필요합니다."',
        "    }",
        "  ]",
      ],
      constraints: [
        "질문은 오직 외부 서비스 연동, 자격 증명, 인증 설정, 접근 권한, 실환경 승인처럼 에이전트가 스스로 알 수 없는 정보일 때만 만든다.",
        "설계/기획/범위 결정 질문은 만들지 않는다.",
        "questions 가 비어 있으면 needsInput 은 false 여야 한다.",
        "질문 문장은 사용자가 바로 답할 수 있게 구체적이어야 한다.",
      ],
    },
  });
}
