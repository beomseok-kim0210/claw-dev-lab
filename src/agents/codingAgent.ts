import { OllamaClient } from "../llm/ollamaClient.js";
import { buildImplementationReviewPrompt, buildImplementationUpdatePrompt } from "../prompts/coding.js";
import type { AgentRole, ChatMessage } from "../types/chat.js";
import {
  implementationReviewSchema,
  implementationUpdateSchema,
  type AIFeaturesSpec,
  type BackendSpec,
  type FrontendSpec,
  type ImplementationPlan,
  type ImplementationReview,
  type ImplementationUpdate,
} from "../types/contracts.js";

type CodingRole = Exclude<AgentRole, "pm">;

export async function runImplementationUpdate(args: {
  client: OllamaClient;
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  task: ImplementationPlan["tasks"][number];
  targetFiles: string[];
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
}): Promise<ImplementationUpdate> {
  const prompt = buildImplementationUpdatePrompt(args);

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: implementationUpdateSchema,
      temperature: 0.1,
      numPredict: 800,
      maxRetries: 5,
    });
  } catch {
    return {
      headline: `${roleTitle(args.role)} 구현 시작`,
      taskId: args.task.id,
      objective: args.task.goal,
      targetFiles: args.targetFiles,
      worklog: takeAtLeast(
        [
          `${roleTitle(args.role)} 책임 범위에 맞춰 핵심 파일 구조를 먼저 생성한다.`,
          ...args.task.deliverables.slice(0, 3),
        ],
        2,
      ),
      validation: takeAtLeast(
        [
          ...args.task.acceptanceCriteria.slice(0, 2),
          "생성된 파일이 다른 역할의 계약과 충돌하지 않는지 확인한다.",
        ],
        2,
      ),
      references: takeReferences(args.messages),
    };
  }
}

export async function runImplementationReview(args: {
  client: OllamaClient;
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
  targetFiles: string[];
}): Promise<ImplementationReview> {
  const prompt = buildImplementationReviewPrompt(args);

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: implementationReviewSchema,
      temperature: 0.1,
      numPredict: 500,
      maxRetries: 5,
    });
  } catch {
    return {
      headline: `${roleTitle(args.role)} 코드 리뷰 메모`,
      reactionType: "refine",
      targetMessageId: args.targetMessage.id,
      targetFiles: args.targetFiles,
      assessment: `${roleTitle(args.role)} 관점에서 연결 경계를 확인했고, 현재 구현은 다음 역할과의 접점을 먼저 고정하는 방향으로 보완하는 것이 적절하다.`,
      adjustment: "파일 경계와 데이터 계약을 명확히 유지하고, 다음 단계에서 연결 테스트를 우선 확인한다.",
      references: takeReferences(args.messages),
    };
  }
}

export function formatImplementationUpdate(update: ImplementationUpdate): string {
  return [
    `제목: ${update.headline}`,
    `구현 작업: ${update.taskId}`,
    `구현 목표: ${update.objective}`,
    "생성 대상 파일:",
    ...update.targetFiles.map((item) => `- ${item}`),
    "작업 요약:",
    ...update.worklog.map((item) => `- ${item}`),
    "검증 포인트:",
    ...update.validation.map((item) => `- ${item}`),
    `참조 메시지: ${update.references.join(", ")}`,
  ].join("\n");
}

export function formatImplementationReview(review: ImplementationReview): string {
  return [
    `제목: ${review.headline}`,
    `메시지 유형: 코드 리뷰`,
    `반응 유형: ${reactionLabel(review.reactionType)}`,
    `대상 메시지: ${review.targetMessageId}`,
    "검토 파일:",
    ...review.targetFiles.map((item) => `- ${item}`),
    `검토 의견: ${review.assessment}`,
    `보완 제안: ${review.adjustment}`,
    `참조 메시지: ${review.references.join(", ")}`,
  ].join("\n");
}

function roleTitle(role: CodingRole): string {
  if (role === "backend") {
    return "백엔드";
  }
  if (role === "frontend") {
    return "프론트엔드";
  }
  return "AI";
}

function reactionLabel(reactionType: ImplementationReview["reactionType"]): string {
  if (reactionType === "challenge") {
    return "반박";
  }
  if (reactionType === "support") {
    return "지지";
  }
  return "보완";
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
    filtered.push("추가 구현 검토가 필요하다.");
  }
  return filtered;
}
