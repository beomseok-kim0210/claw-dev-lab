import { OllamaClient } from "../llm/ollamaClient.js";
import { buildPmFinalPrompt, buildPmInitialPrompt } from "../prompts/pm.js";
import type { ChatMessage } from "../types/chat.js";
import {
  pmFinalDecisionSchema,
  pmInitialDiscussionSchema,
  type PMFinalDecision,
  type PMInitialDiscussion,
} from "../types/contracts.js";

export async function runPmInitialDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<PMInitialDiscussion> {
  const prompt = buildPmInitialPrompt(args.userRequest, args.messages);
  return args.client.generateStructured({
    ...prompt,
    schema: pmInitialDiscussionSchema,
  });
}

export async function runPmFinalDecision(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<PMFinalDecision> {
  const prompt = buildPmFinalPrompt(args.userRequest, args.messages);
  return args.client.generateStructured({
    ...prompt,
    schema: pmFinalDecisionSchema,
  });
}

export function formatPmInitialDiscussion(discussion: PMInitialDiscussion): string {
  return [
    `Headline: ${discussion.headline}`,
    `Problem: ${discussion.problemStatement}`,
    "MVP Goals:",
    ...discussion.mvpGoals.map((goal) => `- ${goal}`),
    "Success Criteria:",
    ...discussion.successCriteria.map((criterion) => `- ${criterion}`),
    `References: ${discussion.references.join(", ")}`,
  ].join("\n");
}

export function formatPmFinalDecision(decision: PMFinalDecision): string {
  return [
    `Headline: ${decision.headline}`,
    `Summary: ${decision.summary}`,
    "Final MVP Scope:",
    ...decision.mvpScope.map((item) => `- ${item}`),
    "Non-Goals:",
    ...decision.nonGoals.map((item) => `- ${item}`),
    "Delivery Plan:",
    ...decision.deliveryPlan.map((item) => `- ${item}`),
    `Final Decision: ${decision.finalDecision}`,
    `References: ${decision.references.join(", ")}`,
  ].join("\n");
}
