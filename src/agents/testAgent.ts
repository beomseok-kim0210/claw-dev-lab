import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildTestDiscussionPrompt, buildTestSpecPrompt } from "../prompts/test.js";
import { buildConversationMessages } from "../prompts/shared.js";
import type { ChatMessage } from "../types/chat.js";
import {
  testDiscussionSchema,
  testSpecSchema,
  type PMFinalDecision,
  type TestDiscussion,
  type TestSpec,
} from "../types/contracts.js";
import { buildDeterministicTestDiscussion } from "./discussionFallbacks.js";
import { buildDeterministicTestSpec } from "./specFallbacks.js";

export async function runTestDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<TestDiscussion> {
  const prompt = buildTestDiscussionPrompt(args.userRequest, args.messages);
  const profile = resolveGenerationProfile(args.client.getModelName(), "discussion");

  try {
    return await args.client.generateStructured({
      ...prompt,
      conversationMessages: buildConversationMessages(args.messages),
      schema: testDiscussionSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicTestDiscussion(args);
  }
}

export async function generateTestSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  testDiscussion: TestDiscussion;
}): Promise<TestSpec> {
  const prompt = buildTestSpecPrompt(args);
  const profile = resolveGenerationProfile(args.client.getModelName(), "spec");

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: testSpecSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicTestSpec(args);
  }
}

export function formatTestDiscussion(discussion: TestDiscussion): string {
  return [
    `제목: ${discussion.headline}`,
    `요약: ${discussion.summary}`,
    `핵심 주장: ${discussion.claim}`,
    "주장 근거:",
    ...discussion.support.map((item) => `- ${item}`),
    `반박 대상: ${discussion.rebuttalTarget}`,
    `반박: ${discussion.rebuttal}`,
    "테스트 접근:",
    ...discussion.testApproach.map((item) => `- ${item}`),
    "커버리지 초점:",
    ...discussion.coverageFocus.map((item) => `- ${item}`),
    "품질 리스크:",
    ...discussion.qualityRisks.map((item) => `- ${item}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}
