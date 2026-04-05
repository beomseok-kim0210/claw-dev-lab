import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildBackendDiscussionPrompt, buildBackendSpecPrompt } from "../prompts/backend.js";
import type { ChatMessage } from "../types/chat.js";
import {
  backendDiscussionSchema,
  backendSpecSchema,
  type BackendDiscussion,
  type BackendSpec,
  type PMFinalDecision,
} from "../types/contracts.js";
import { buildDeterministicBackendDiscussion } from "./discussionFallbacks.js";
import { buildDeterministicBackendSpec } from "./specFallbacks.js";

export async function runBackendDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<BackendDiscussion> {
  const prompt = buildBackendDiscussionPrompt(args.userRequest, args.messages);
  const profile = resolveGenerationProfile(args.client.getModelName(), "discussion");

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: backendDiscussionSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicBackendDiscussion(args);
  }
}

export async function generateBackendSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendDiscussion: BackendDiscussion;
}): Promise<BackendSpec> {
  const prompt = buildBackendSpecPrompt(args);
  const profile = resolveGenerationProfile(args.client.getModelName(), "spec");

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: backendSpecSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicBackendSpec(args);
  }
}

export function formatBackendDiscussion(discussion: BackendDiscussion): string {
  return [
    `제목: ${discussion.headline}`,
    `요약: ${discussion.summary}`,
    `핵심 주장: ${discussion.claim}`,
    "주장 근거:",
    ...discussion.support.map((item) => `- ${item}`),
    `반박 대상: ${discussion.rebuttalTarget}`,
    `반박: ${discussion.rebuttal}`,
    "API 제안:",
    ...discussion.apiDesign.map((item) => `- ${item}`),
    "데이터 모델:",
    ...discussion.dataModel.map((item) => `- ${item}`),
    "제약 사항:",
    ...discussion.constraints.map((item) => `- ${item}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}
