import type { ChatMessage } from "../types/chat.js";

export const KOREAN_OUTPUT_RULE =
  "모든 사람이 읽는 문장과 목록 항목은 한국어로 작성하라. JSON 키, message ID, 코드 식별자, 파일명은 필요할 때만 영어를 유지하라.";

export function renderTranscript(messages: ChatMessage[]): string {
  return messages
    .map((message) =>
      [
        `[${message.id}] turn=${message.turn} speaker=${message.speaker} role=${message.role}`,
        message.content,
      ].join("\n"),
    )
    .join("\n\n");
}

export function renderMessageIds(messages: ChatMessage[]): string {
  return messages.map((message) => message.id).join(", ");
}

export function renderDiscussionContext(userRequest: string, messages: ChatMessage[]): string {
  return [
    `사용자 요청: ${userRequest}`,
    `참조 가능한 메시지 ID: ${renderMessageIds(messages)}`,
    "대화 기록:",
    renderTranscript(messages),
  ].join("\n\n");
}
