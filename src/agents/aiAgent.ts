import { OllamaClient } from "../llm/ollamaClient.js";
import { buildAIDiscussionPrompt, buildAIFeaturesSpecPrompt } from "../prompts/ai.js";
import type { ChatMessage } from "../types/chat.js";
import {
  aiDiscussionSchema,
  aiFeaturesSpecSchema,
  type AIDiscussion,
  type AIFeaturesSpec,
  type PMFinalDecision,
} from "../types/contracts.js";

export async function runAIDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<AIDiscussion> {
  const prompt = buildAIDiscussionPrompt(args.userRequest, args.messages);
  return args.client.generateStructured({
    ...prompt,
    schema: aiDiscussionSchema,
  });
}

export async function generateAIFeaturesSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  aiDiscussion: AIDiscussion;
}): Promise<AIFeaturesSpec> {
  const prompt = buildAIFeaturesSpecPrompt(args);
  return args.client.generateStructured({
    ...prompt,
    schema: aiFeaturesSpecSchema,
  });
}

export function formatAIDiscussion(discussion: AIDiscussion): string {
  return [
    `제목: ${discussion.headline}`,
    `요약: ${discussion.summary}`,
    `핵심 주장: ${discussion.claim}`,
    "주장 근거:",
    ...discussion.support.map((item) => `- ${item}`),
    `반박 대상: ${discussion.rebuttalTarget}`,
    `반박: ${discussion.rebuttal}`,
    "AI 기능:",
    ...discussion.aiFeatures.map((item) => `- ${item}`),
    "실현 가능성:",
    ...discussion.feasibility.map((item) => `- ${item}`),
    "위험 요소:",
    ...discussion.risks.map((item) => `- ${item}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}
