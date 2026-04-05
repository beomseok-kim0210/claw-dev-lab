import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildInfraDiscussionPrompt, buildInfraSpecPrompt } from "../prompts/infra.js";
import type { ChatMessage } from "../types/chat.js";
import {
  infraDiscussionSchema,
  infraSpecSchema,
  type InfraDiscussion,
  type InfraSpec,
  type PMFinalDecision,
} from "../types/contracts.js";
import { buildDeterministicInfraDiscussion } from "./discussionFallbacks.js";
import { buildDeterministicInfraSpec } from "./specFallbacks.js";

export async function runInfraDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<InfraDiscussion> {
  const prompt = buildInfraDiscussionPrompt(args.userRequest, args.messages);
  const profile = resolveGenerationProfile(args.client.getModelName(), "discussion");

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: infraDiscussionSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicInfraDiscussion(args);
  }
}

export async function generateInfraSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  infraDiscussion: InfraDiscussion;
}): Promise<InfraSpec> {
  const prompt = buildInfraSpecPrompt(args);
  const profile = resolveGenerationProfile(args.client.getModelName(), "spec");

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: infraSpecSchema,
      ...profile,
    });
  } catch {
    return buildDeterministicInfraSpec(args);
  }
}

export function formatInfraDiscussion(discussion: InfraDiscussion): string {
  return [
    `제목: ${discussion.headline}`,
    `요약: ${discussion.summary}`,
    `핵심 주장: ${discussion.claim}`,
    "주장 근거:",
    ...discussion.support.map((item) => `- ${item}`),
    `반박 대상: ${discussion.rebuttalTarget}`,
    `반박: ${discussion.rebuttal}`,
    "배포 토폴로지:",
    ...discussion.deploymentTopology.map((item) => `- ${item}`),
    "환경 분리:",
    ...discussion.environments.map((item) => `- ${item}`),
    "관측 항목:",
    ...discussion.observability.map((item) => `- ${item}`),
    `참조 메시지: ${discussion.references.join(", ")}`,
  ].join("\n");
}
