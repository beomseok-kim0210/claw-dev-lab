import { OllamaClient } from "../llm/ollamaClient.js";
import { buildFrontendDiscussionPrompt, buildFrontendSpecPrompt } from "../prompts/frontend.js";
import type { ChatMessage } from "../types/chat.js";
import {
  frontendDiscussionSchema,
  frontendSpecSchema,
  type FrontendDiscussion,
  type FrontendSpec,
  type PMFinalDecision,
} from "../types/contracts.js";

export async function runFrontendDiscussion(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<FrontendDiscussion> {
  const prompt = buildFrontendDiscussionPrompt(args.userRequest, args.messages);
  return args.client.generateStructured({
    ...prompt,
    schema: frontendDiscussionSchema,
  });
}

export async function generateFrontendSpec(args: {
  client: OllamaClient;
  userRequest: string;
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): Promise<FrontendSpec> {
  const prompt = buildFrontendSpecPrompt(args);
  return args.client.generateStructured({
    ...prompt,
    schema: frontendSpecSchema,
  });
}

export function formatFrontendDiscussion(discussion: FrontendDiscussion): string {
  return [
    `Headline: ${discussion.headline}`,
    `Summary: ${discussion.summary}`,
    "Screens:",
    ...discussion.screens.map((item) => `- ${item}`),
    "Components:",
    ...discussion.components.map((item) => `- ${item}`),
    "Usability Notes:",
    ...discussion.usabilityNotes.map((item) => `- ${item}`),
    `References: ${discussion.references.join(", ")}`,
  ].join("\n");
}
