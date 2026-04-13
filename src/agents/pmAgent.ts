import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import type { LLMClient } from "../llm/llmClient.js";
import { buildConversationMessages } from "../prompts/shared.js";
import { buildPmFinalPrompt, buildPmInitialPrompt } from "../prompts/pm.js";
import type { ChatMessage } from "../types/chat.js";
import {
  pmFinalDecisionSchema,
  pmInitialDiscussionSchema,
  type PMFinalDecision,
  type PMInitialDiscussion,
} from "../types/contracts.js";
import { buildDeterministicPmFinalDecision, buildDeterministicPmInitialDiscussion } from "./discussionFallbacks.js";

export async function runPmInitialDiscussion(args: {
  client: LLMClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<PMInitialDiscussion> {
  const prompt = buildPmInitialPrompt(args.userRequest, args.messages);
  const profile = resolveGenerationProfile(args.client.getModelName(), "pm-initial");

  try {
    return await args.client.generateStructured({
      ...prompt,
      conversationMessages: buildConversationMessages(args.messages),
      schema: pmInitialDiscussionSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicPmInitialDiscussion(args);
  }
}

export async function runPmFinalDecision(args: {
  client: LLMClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<PMFinalDecision> {
  const prompt = buildPmFinalPrompt(args.userRequest, args.messages);
  const profile = resolveGenerationProfile(args.client.getModelName(), "pm-final");

  try {
    return await args.client.generateStructured({
      ...prompt,
      conversationMessages: buildConversationMessages(args.messages),
      schema: pmFinalDecisionSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicPmFinalDecision(args);
  }
}

export function formatPmInitialDiscussion(discussion: PMInitialDiscussion): string {
  return [
    `제목: ${discussion.headline}`,
    `문제 정의: ${discussion.problemStatement}`,
    "MVP 목표:",
    ...discussion.mvpGoals.map((item) => `- ${item}`),
    "성공 기준:",
    ...discussion.successCriteria.map((item) => `- ${item}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}

export function formatPmFinalDecision(decision: PMFinalDecision): string {
  return [
    `제목: ${decision.headline}`,
    `요약: ${decision.summary}`,
    "MVP 범위:",
    ...decision.mvpScope.map((item) => `- ${item}`),
    "비목표:",
    ...decision.nonGoals.map((item) => `- ${item}`),
    "전달 계획:",
    ...decision.deliveryPlan.map((item) => `- ${item}`),
    `최종 결정: ${decision.finalDecision}`,
    `참조 메시지: ${decision.references.join(", ")}`,
  ].join("\n");
}
