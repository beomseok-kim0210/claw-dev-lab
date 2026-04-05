import type { ChatMessage } from "../types/chat.js";
import type { AgentReaction } from "../types/contracts.js";

export async function runAgentReaction(args: {
  client?: unknown;
  role: "backend" | "frontend" | "ai" | "infra" | "test";
  userRequest: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
}): Promise<AgentReaction> {
  const reactionType = pickReactionType(args.role, args.targetMessage.role);

  return {
    headline: `${roleLabel(args.role)} response`,
    reactionType,
    targetMessageId: args.targetMessage.id,
    position: `${roleLabel(args.role)} is reacting to the previous ${args.targetMessage.role} message from its own delivery angle.`,
    reaction: buildReactionBody(args.role, reactionType, args.targetMessage),
    adjustment: buildAdjustment(args.role, args.targetMessage),
    references: takeReferences(args.messages),
  };
}

export function formatAgentReaction(reaction: AgentReaction): string {
  return [
    `Title: ${reaction.headline}`,
    `Message Type: ${mapReactionType(reaction.reactionType)}`,
    `Target Message: ${reaction.targetMessageId}`,
    `Position: ${reaction.position}`,
    `Reaction: ${reaction.reaction}`,
    `Adjustment: ${reaction.adjustment}`,
    `References: ${reaction.references.join(", ")}`,
  ].join("\n");
}

function pickReactionType(
  role: "backend" | "frontend" | "ai" | "infra" | "test",
  targetRole: ChatMessage["role"],
): AgentReaction["reactionType"] {
  if (role === "ai" || targetRole === "pm") {
    return "support";
  }
  if (role === "infra" || role === "test" || (role === "backend" && targetRole === "frontend")) {
    return "challenge";
  }
  return "refine";
}

function buildReactionBody(
  role: "backend" | "frontend" | "ai" | "infra" | "test",
  reactionType: AgentReaction["reactionType"],
  targetMessage: ChatMessage,
): string {
  const summary = shrink(targetMessage.content);
  if (reactionType === "challenge") {
    return `${roleLabel(role)} agrees with the direction but is pushing for a sharper implementation boundary after reading: "${summary}".`;
  }
  if (reactionType === "support") {
    return `${roleLabel(role)} sees the previous point as aligned with the current request and wants to preserve it in the next phase: "${summary}".`;
  }
  return `${roleLabel(role)} is refining the previous point so the next agent can act on it without extra interpretation: "${summary}".`;
}

function buildAdjustment(
  role: "backend" | "frontend" | "ai" | "infra" | "test",
  targetMessage: ChatMessage,
): string {
  if (role === "backend") {
    return `Convert the point from ${targetMessage.id} into explicit API shape, entity names, or file ownership.`;
  }
  if (role === "frontend") {
    return `Translate the point from ${targetMessage.id} into concrete screens, components, and visible user actions.`;
  }
  if (role === "infra") {
    return `Make the point from ${targetMessage.id} testable through run commands, env values, or deployment notes.`;
  }
  if (role === "test") {
    return `Convert the point from ${targetMessage.id} into a runnable smoke test, contract check, or blocking quality gate.`;
  }
  return `Turn the point from ${targetMessage.id} into deterministic insight logic or analysis-friendly structure.`;
}

function takeReferences(messages: ChatMessage[]): string[] {
  const ids = messages
    .slice(-3)
    .map((message) => message.id)
    .filter((value, index, array) => array.indexOf(value) === index);

  return ids.length > 0 ? ids : ["msg-001"];
}

function mapReactionType(value: AgentReaction["reactionType"]): string {
  if (value === "challenge") {
    return "challenge";
  }
  if (value === "support") {
    return "support";
  }
  return "refine";
}

function roleLabel(role: "backend" | "frontend" | "ai" | "infra" | "test"): string {
  if (role === "backend") {
    return "Backend";
  }
  if (role === "frontend") {
    return "Frontend";
  }
  if (role === "infra") {
    return "Infra";
  }
  if (role === "test") {
    return "Test";
  }
  return "AI";
}

function shrink(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}
