import { OllamaClient } from "../llm/ollamaClient.js";
import { buildFrontendDiscussionPrompt, buildFrontendSpecPrompt } from "../prompts/frontend.js";
import type { ChatMessage } from "../types/chat.js";
import {
  frontendDiscussionSchema,
  frontendSpecSchema,
  type FrontendDiscussion,
  type FrontendSpec,
  type PMFinalDecision,
} from "../types/contracts.js";

export async function runFrontendDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<FrontendDiscussion> {
  const prompt = buildFrontendDiscussionPrompt(args.userRequest, args.messages);
  return args.client.generateStructured({
    ...prompt,
    schema: frontendDiscussionSchema,
  });
}

export async function generateFrontendSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): Promise<FrontendSpec> {
  const prompt = buildFrontendSpecPrompt(args);
  return args.client.generateStructured({
    ...prompt,
    schema: frontendSpecSchema,
  });
}

export function formatFrontendDiscussion(discussion: FrontendDiscussion): string {
  return [
    `제목: ${discussion.headline}`,
    `요약: ${discussion.summary}`,
    "화면 구성:",
    ...discussion.screens.map((item) => `- ${item}`),
    "컴포넌트 구성:",
    ...discussion.components.map((item) => `- ${item}`),
    "사용성 메모:",
    ...discussion.usabilityNotes.map((item) => `- ${item}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}
