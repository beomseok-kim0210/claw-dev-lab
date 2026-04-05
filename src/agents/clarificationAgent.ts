import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildClarificationPrompt } from "../prompts/clarification.js";
import type { ChatMessage } from "../types/chat.js";
import { clarificationPlanSchema, type ClarificationPlan } from "../types/contracts.js";

export async function planClarification(args: {
  client: OllamaClient;
  userRequest: string;
  messages: ChatMessage[];
}): Promise<ClarificationPlan> {
  const prompt = buildClarificationPrompt(args.userRequest, args.messages);
  const profile = resolveGenerationProfile(args.client.getModelName(), "clarification");

  try {
    return await args.client.generateStructured({
      ...prompt,
      schema: clarificationPlanSchema,
      ...profile,
    });
  } catch {
    return {
      needsInput: false,
      summary: "추가 확인 없이 현재 정보로 진행해도 된다고 판단했습니다.",
      questions: [],
    };
  }
}

export function formatClarificationQuestionMessage(plan: ClarificationPlan): string {
  return [
    "제목: 사용자 확인 요청",
    `확인 이유: ${plan.summary}`,
    "질문 목록:",
    ...plan.questions.flatMap((question) => [
      `- ${question.id} / ${question.askedBy} / ${question.topic}`,
      `- 질문: ${question.question}`,
      `- 이유: ${question.reason}`,
    ]),
  ].join("\n");
}

export function formatClarificationAnswerMessage(answers: Array<{ questionId: string; answer: string }>): string {
  return [
    "제목: 사용자 응답",
    "응답 내용:",
    ...answers.map((item) => `- ${item.questionId}: ${item.answer}`),
  ].join("\n");
}
