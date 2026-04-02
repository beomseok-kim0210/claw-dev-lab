import { OllamaClient } from "../llm/ollamaClient.js";
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
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<PMInitialDiscussion> {
  const prompt = buildPmInitialPrompt(args.userRequest, args.messages);
  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: pmInitialDiscussionSchema,
      temperature: 0.1,
      numPredict: 500,
      maxRetries: 5,
    });
  } catch {
    return buildDeterministicPmInitialDiscussion(args);
  }
}

export async function runPmFinalDecision(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<PMFinalDecision> {
  const prompt = buildPmFinalPrompt(args.userRequest, args.messages);
  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: pmFinalDecisionSchema,
      temperature: 0.1,
      numPredict: 700,
      maxRetries: 5,
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
    ...discussion.mvpGoals.map((goal) => `- ${goal}`),
    "성공 기준:",
    ...discussion.successCriteria.map((criterion) => `- ${criterion}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}

export function formatPmFinalDecision(decision: PMFinalDecision): string {
  return [
    `제목: ${decision.headline}`,
    `요약: ${decision.summary}`,
    "최종 MVP 범위:",
    ...decision.mvpScope.map((item) => `- ${item}`),
    "제외 범위:",
    ...decision.nonGoals.map((item) => `- ${item}`),
    "진행 계획:",
    ...decision.deliveryPlan.map((item) => `- ${item}`),
    `최종 결정: ${decision.finalDecision}`,
    `참조 메시지: ${decision.references.join(", ")}`,
  ].join("\n");
}
