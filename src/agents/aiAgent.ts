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
    `Headline: ${discussion.headline}`,
    `Summary: ${discussion.summary}`,
    "AI Features:",
    ...discussion.aiFeatures.map((item) => `- ${item}`),
    "Feasibility:",
    ...discussion.feasibility.map((item) => `- ${item}`),
    "Risks:",
    ...discussion.risks.map((item) => `- ${item}`),
    `References: ${discussion.references.join(", ")}`,
  ].join("\n");
}
