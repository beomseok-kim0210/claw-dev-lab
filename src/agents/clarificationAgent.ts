import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildClarificationPrompt } from "../prompts/clarification.js";
import type { ChatMessage } from "../types/chat.js";
import {
  clarificationPlanSchema,
  type ClarificationPlan,
  type ClarificationQuestion,
} from "../types/contracts.js";

const EXTERNAL_SIGNAL_PATTERN =
  /\b(api key|apikey|token|secret|oauth|google auth|google login|dart|redirect uri|callback url|service account|credential|client id|client secret|firebase|slack|notion|github app|webhook|sso|domain|smtp|s3|bucket|access key|bearer|open api)\b/iu;

export async function planClarification(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<ClarificationPlan> {
  const prompt = buildClarificationPrompt(args.userRequest, args.messages);
  const profile = resolveGenerationProfile(args.client.getModelName(), "clarification");

  try {
    const generated = await args.client.generateStructured({
      ...prompt,
      schema: clarificationPlanSchema,
      ...profile,
    });
    return sanitizeClarificationPlan(generated);
  } catch {
    return {
      needsInput: false,
      summary: "외부 입력 없이 현재 정보로 진행 가능합니다.",
      questions: [],
    };
  }
}

export function formatClarificationQuestionMessage(plan: ClarificationPlan): string {
  return [
    "제목: 사용자 확인 요청",
    `확인 이유: ${plan.summary}`,
    "질문:",
    ...plan.questions.flatMap((question) => [
      `- ${question.id} · ${question.askedBy} · ${question.topic}`,
      `- ${question.question}`,
    ]),
  ].join("\n");
}

export function formatClarificationAnswerMessage(answers: Array<{ questionId: string; answer: string }>): string {
  return [
    "제목: 사용자 응답",
    ...answers.map((item) => `- ${item.questionId}: ${item.answer}`),
  ].join("\n");
}

function sanitizeClarificationPlan(plan: ClarificationPlan): ClarificationPlan {
  const questions = plan.questions.filter(isAllowedClarificationQuestion).slice(0, 3);

  if (questions.length === 0) {
    return {
      needsInput: false,
      summary: "외부 입력 없이 현재 정보와 합리적인 가정으로 진행 가능합니다.",
      questions: [],
    };
  }

  return {
    needsInput: true,
    summary: normalizeSummary(plan.summary),
    questions,
  };
}

function isAllowedClarificationQuestion(question: ClarificationQuestion): boolean {
  const combined = `${question.question}\n${question.reason}`.toLowerCase();
  const topicAllows =
    question.topic === "credential" ||
    question.topic === "auth" ||
    question.topic === "integration" ||
    question.topic === "approval";

  if (topicAllows) {
    return true;
  }

  if (EXTERNAL_SIGNAL_PATTERN.test(combined)) {
    return true;
  }

  return false;
}

function normalizeSummary(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length === 0) {
    return "실제 연동이나 인증에 필요한 외부 입력이 필요합니다.";
  }
  if (EXTERNAL_SIGNAL_PATTERN.test(trimmed.toLowerCase())) {
    return trimmed;
  }
  return "실제 연동이나 인증에 필요한 외부 입력이 필요합니다.";
}
