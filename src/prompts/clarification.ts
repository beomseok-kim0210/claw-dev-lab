import type { ChatMessage } from "../types/chat.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildClarificationPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "pm",
    mode: "discussion",
    objective: "Decide whether the user must provide external credentials, integration settings, or approvals before implementation can continue.",
    responsibilities: [
      "Ask only for information that agents cannot safely infer on their own.",
      "Valid examples are API keys, OAuth client settings, callback URLs, service accounts, deployment domains, webhook endpoints, or explicit approval to use a real external service.",
      "Do not ask product-design questions such as API count, screen structure, MVP scope, data model shape, or feature priority. Agents must settle those through discussion.",
      "Do not mention a concrete external service unless the user request or prior messages already mention that service.",
      "If the project can proceed with a reasonable mock or placeholder assumption, do not ask the user.",
      "Ask at most 3 questions.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "needsInput": true,',
        '  "summary": "어떤 외부 입력이 필요한지 한 줄로 요약",',
        '  "questions": [',
        "    {",
        '      "id": "clarify-01",',
        '      "askedBy": "infra",',
        '      "topic": "credential",',
        '      "question": "실제 외부 연동에 필요한 API 키나 자격 정보가 있나요?",',
        '      "reason": "실서비스 연동에는 사용자가 제공해야 하는 자격 정보가 필요할 수 있습니다."',
        "    }",
        "  ]",
      ],
      constraints: [
        "Question text and summary must be written in Korean.",
        "Only create questions about external integrations, credentials, auth configuration, approvals, or production environment ownership.",
        "Never ask about implementation scope, product design, UI structure, or how many APIs/features should exist.",
        "If you mention a concrete service, that service must already appear in the user request or transcript.",
        "If questions is empty, set needsInput to false.",
        "Keep questions direct enough that the user can answer immediately.",
      ],
    },
  });
}
