import type { AgentRole, ChatMessage } from "../types/chat.js";
import type {
  AIFeaturesSpec,
  BackendSpec,
  FrontendSpec,
  ImplementationPlan,
  ImplementationReview,
  ImplementationUpdate,
  InfraSpec,
} from "../types/contracts.js";

type CodingRole = Exclude<AgentRole, "pm">;

export async function runImplementationUpdate(args: {
  client?: unknown;
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  task: ImplementationPlan["tasks"][number];
  targetFiles: string[];
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
  infraSpec: InfraSpec;
}): Promise<ImplementationUpdate> {
  return {
    headline: `${roleTitle(args.role)} implementation start`,
    taskId: args.task.id,
    objective: args.task.goal,
    targetFiles: args.targetFiles,
    worklog: takeAtLeast(
      [
        `${roleTitle(args.role)} owns the files for ${args.task.title.toLowerCase()}.`,
        `The bundle is being generated directly from the assigned deliverables: ${args.task.deliverables.join(", ")}.`,
        `The request context is kept narrow: ${shrink(args.userRequest)}.`,
      ],
      2,
    ),
    validation: takeAtLeast(
      [
        ...args.task.acceptanceCriteria.slice(0, 2),
        "Generated files must stay within the role boundary and avoid collisions with existing output.",
      ],
      2,
    ),
    references: takeReferences(args.messages),
  };
}

export async function runImplementationReview(args: {
  client?: unknown;
  role: CodingRole;
  userRequest?: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
  targetFiles: string[];
}): Promise<ImplementationReview> {
  return {
    headline: `${roleTitle(args.role)} review note`,
    reactionType: "refine",
    targetMessageId: args.targetMessage.id,
    targetFiles: args.targetFiles,
    assessment: `${roleTitle(args.role)} reviewed the generated file bundle and checked whether the handoff to the next role stays clear.`,
    adjustment: "Keep the file ownership boundaries strict and make sure the next step can consume the generated files without guessing.",
    references: takeReferences(args.messages),
  };
}

export function formatImplementationUpdate(update: ImplementationUpdate): string {
  return [
    `Title: ${update.headline}`,
    `Task: ${update.taskId}`,
    `Objective: ${update.objective}`,
    "Target Files:",
    ...update.targetFiles.map((item) => `- ${item}`),
    "Worklog:",
    ...update.worklog.map((item) => `- ${item}`),
    "Validation:",
    ...update.validation.map((item) => `- ${item}`),
    `References: ${update.references.join(", ")}`,
  ].join("\n");
}

export function formatImplementationReview(review: ImplementationReview): string {
  return [
    `Title: ${review.headline}`,
    "Message Type: code review",
    `Reaction: ${reactionLabel(review.reactionType)}`,
    `Target Message: ${review.targetMessageId}`,
    "Reviewed Files:",
    ...review.targetFiles.map((item) => `- ${item}`),
    `Assessment: ${review.assessment}`,
    `Adjustment: ${review.adjustment}`,
    `References: ${review.references.join(", ")}`,
  ].join("\n");
}

function roleTitle(role: CodingRole): string {
  if (role === "backend") {
    return "Backend";
  }
  if (role === "frontend") {
    return "Frontend";
  }
  if (role === "infra") {
    return "Infra";
  }
  return "AI";
}

function reactionLabel(reactionType: ImplementationReview["reactionType"]): string {
  if (reactionType === "challenge") {
    return "challenge";
  }
  if (reactionType === "support") {
    return "support";
  }
  return "refine";
}

function takeReferences(messages: ChatMessage[]): string[] {
  const ids = messages
    .slice(-3)
    .map((message) => message.id)
    .filter((value, index, array) => array.indexOf(value) === index);

  return ids.length > 0 ? ids : ["msg-001"];
}

function takeAtLeast(items: string[], minimum: number): string[] {
  const filtered = items.filter((item) => item.trim().length > 0).slice(0, 5);
  while (filtered.length < minimum) {
    filtered.push("Add one more verification note.");
  }
  return filtered;
}

function shrink(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}
