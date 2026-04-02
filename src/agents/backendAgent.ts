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

export async function runBackendDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<BackendDiscussion> {
  const prompt = buildBackendDiscussionPrompt(args.userRequest, args.messages);
  return args.client.generateStructured({
    ...prompt,
    schema: backendDiscussionSchema,
  });
}

export async function generateBackendSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendDiscussion: BackendDiscussion;
}): Promise<BackendSpec> {
  const prompt = buildBackendSpecPrompt(args);
  return args.client.generateStructured({
    ...prompt,
    schema: backendSpecSchema,
  });
}

export function formatBackendDiscussion(discussion: BackendDiscussion): string {
  return [
    `Headline: ${discussion.headline}`,
    `Summary: ${discussion.summary}`,
    "API Design:",
    ...discussion.apiDesign.map((item) => `- ${item}`),
    "Data Model:",
    ...discussion.dataModel.map((item) => `- ${item}`),
    "Constraints:",
    ...discussion.constraints.map((item) => `- ${item}`),
    `References: ${discussion.references.join(", ")}`,
  ].join("\n");
}
