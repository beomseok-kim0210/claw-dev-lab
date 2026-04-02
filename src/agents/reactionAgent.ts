import { OllamaClient } from "../llm/ollamaClient.js";
import { buildReactionPrompt } from "../prompts/reaction.js";
import type { ChatMessage } from "../types/chat.js";
import { agentReactionSchema, type AgentReaction } from "../types/contracts.js";
import { buildDeterministicReaction } from "./discussionFallbacks.js";

export async function runAgentReaction(args: {
  client: OllamaClient;
  role: "backend" | "frontend" | "ai" | "infra";
  userRequest: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
}): Promise<AgentReaction> {
  const prompt = buildReactionPrompt(args);
  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: agentReactionSchema,
      temperature: 0.1,
      numPredict: 350,
      maxRetries: 5,
    });
  } catch {
    return buildDeterministicReaction(args);
  }
}

export function formatAgentReaction(reaction: AgentReaction): string {
  return [
    `제목: ${reaction.headline}`,
    `메시지 유형: ${mapReactionType(reaction.reactionType)}`,
    `대상 메시지: ${reaction.targetMessageId}`,
    `현재 입장: ${reaction.position}`,
    `반응: ${reaction.reaction}`,
    `보완 제안: ${reaction.adjustment}`,
    `참조 메시지: ${reaction.references.join(", ")}`,
  ].join("\n");
}

function mapReactionType(value: AgentReaction["reactionType"]): string {
  if (value === "challenge") {
    return "반박";
  }
  if (value === "support") {
    return "지지";
  }
  return "보완";
}
