import type { ChatMessage } from "../types/chat.js";

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
    `User request: ${userRequest}`,
    `Available message IDs: ${renderMessageIds(messages)}`,
    "Transcript:",
    renderTranscript(messages),
  ].join("\n\n");
}
