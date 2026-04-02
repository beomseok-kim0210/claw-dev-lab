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
import { buildDeterministicFrontendDiscussion } from "./discussionFallbacks.js";
import { buildDeterministicFrontendSpec } from "./specFallbacks.js";

export async function runFrontendDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<FrontendDiscussion> {
  const prompt = buildFrontendDiscussionPrompt(args.userRequest, args.messages);
  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: frontendDiscussionSchema,
      temperature: 0.1,
      numPredict: 600,
      maxRetries: 5,
    });
  } catch {
    return buildDeterministicFrontendDiscussion(args);
  }
}

export async function generateFrontendSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): Promise<FrontendSpec> {
  const prompt = buildFrontendSpecPrompt(args);
  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: frontendSpecSchema,
      temperature: 0.1,
      numPredict: 900,
      maxRetries: 5,
    });
  } catch {
    return buildDeterministicFrontendSpec(args);
  }
}

export function formatFrontendDiscussion(discussion: FrontendDiscussion): string {
  return [
    `제목: ${discussion.headline}`,
    `요약: ${discussion.summary}`,
    `핵심 주장: ${discussion.claim}`,
    "주장 근거:",
    ...discussion.support.map((item) => `- ${item}`),
    `반박 대상: ${discussion.rebuttalTarget}`,
    `반박: ${discussion.rebuttal}`,
    "화면 구성:",
    ...discussion.screens.map((item) => `- ${item}`),
    "컴포넌트 구성:",
    ...discussion.components.map((item) => `- ${item}`),
    "사용성 메모:",
    ...discussion.usabilityNotes.map((item) => `- ${item}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}
