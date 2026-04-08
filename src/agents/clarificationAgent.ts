import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildClarificationPrompt } from "../prompts/clarification.js";
import { buildConversationMessages } from "../prompts/shared.js";
import type { ChatMessage } from "../types/chat.js";
import {
  clarificationPlanSchema,
  type ClarificationPlan,
  type ClarificationQuestion,
} from "../types/contracts.js";

const GENERIC_EXTERNAL_PATTERN =
  /\b(api key|apikey|token|secret|oauth|redirect uri|callback url|service account|credential|client id|client secret|webhook|sso|domain|smtp|s3|bucket|access key|bearer|open api|integration key)\b/iu;

const KOREAN_EXTERNAL_PATTERN =
  /(api 키|토큰|시크릿|oauth|인증|로그인|리디렉션|콜백|도메인|웹훅|서비스 계정|자격 정보|외부 연동|메일 서버|버킷|권한 승인)/iu;

const DESIGN_QUESTION_PATTERN =
  /(\bhow many\b|\bnumber of api\b|\bmvp\b|\bscope\b|\bdata model\b|\bschema\b|\bscreen\b|\bux\b|핵심 api|api 몇|몇 개의 api|데이터 모델|스키마|화면 구성|ui 구성|mvp|범위|설계|아키텍처)/iu;

const SERVICE_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: "dart", pattern: /\bdart\b|전자공시|공시자료/iu },
  { key: "google", pattern: /\bgoogle\b|구글/iu },
  { key: "firebase", pattern: /\bfirebase\b/iu },
  { key: "github", pattern: /\bgithub\b|깃허브/iu },
  { key: "notion", pattern: /\bnotion\b/iu },
  { key: "slack", pattern: /\bslack\b/iu },
  { key: "aws", pattern: /\baws\b|\bs3\b|버킷|bucket/iu },
  { key: "smtp", pattern: /\bsmtp\b|메일 서버|email server/iu },
];

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
      conversationMessages: buildConversationMessages(args.messages),
      schema: clarificationPlanSchema,
      ...profile,
    });
    return sanitizeClarificationPlan(generated, args.userRequest, args.messages);
  } catch {
    return {
      needsInput: false,
      summary: "외부 연동이나 인증에 필요한 추가 입력 없이 현재 정보로 진행 가능합니다.",
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
      `- ${question.id} / ${question.askedBy} / ${question.topic}`,
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

function sanitizeClarificationPlan(
  plan: ClarificationPlan,
  userRequest: string,
  messages: ChatMessage[],
): ClarificationPlan {
  const contextText = [userRequest, ...messages.map((message) => message.content)].join("\n");
  const groundedServices = collectGroundedServices(contextText);
  if (!hasClarificationGrounding(contextText, groundedServices)) {
    return {
      needsInput: false,
      summary: "외부 연동이나 인증에 필요한 추가 입력 없이 현재 정보로 진행 가능합니다.",
      questions: [],
    };
  }
  const questions = plan.questions
    .filter((question) => isAllowedClarificationQuestion(question, groundedServices))
    .slice(0, 3);

  if (questions.length === 0) {
    return {
      needsInput: false,
      summary: "외부 연동이나 인증에 필요한 추가 입력 없이 현재 정보로 진행 가능합니다.",
      questions: [],
    };
  }

  return {
    needsInput: true,
    summary: normalizeSummary(plan.summary, groundedServices),
    questions,
  };
}

function isAllowedClarificationQuestion(question: ClarificationQuestion, groundedServices: Set<string>): boolean {
  const combined = `${question.question}\n${question.reason}`;
  const combinedLower = combined.toLowerCase();
  const topicAllows =
    question.topic === "credential" ||
    question.topic === "auth" ||
    question.topic === "integration" ||
    question.topic === "approval";

  if (DESIGN_QUESTION_PATTERN.test(combined)) {
    return false;
  }

  if (mentionsUngroundedService(combined, groundedServices)) {
    return false;
  }

  if (topicAllows) {
    return true;
  }

  return GENERIC_EXTERNAL_PATTERN.test(combinedLower);
}

function normalizeSummary(summary: string, groundedServices: Set<string>): string {
  const trimmed = summary.trim();
  if (trimmed.length === 0) {
    return "외부 연동이나 인증에 필요한 사용자 입력이 있어 확인이 필요합니다.";
  }
  if (mentionsUngroundedService(trimmed, groundedServices)) {
    return "외부 연동이나 인증에 필요한 사용자 입력이 있어 확인이 필요합니다.";
  }
  if (GENERIC_EXTERNAL_PATTERN.test(trimmed.toLowerCase()) || mentionsGroundedService(trimmed, groundedServices)) {
    return trimmed;
  }
  return "외부 연동이나 인증에 필요한 사용자 입력이 있어 확인이 필요합니다.";
}

function collectGroundedServices(source: string): Set<string> {
  const grounded = new Set<string>();
  for (const service of SERVICE_PATTERNS) {
    if (service.pattern.test(source)) {
      grounded.add(service.key);
    }
  }
  return grounded;
}

function hasClarificationGrounding(source: string, groundedServices: Set<string>): boolean {
  if (groundedServices.size > 0) {
    return true;
  }

  return GENERIC_EXTERNAL_PATTERN.test(source) || KOREAN_EXTERNAL_PATTERN.test(source);
}

function mentionsUngroundedService(source: string, groundedServices: Set<string>): boolean {
  for (const service of SERVICE_PATTERNS) {
    if (service.pattern.test(source) && !groundedServices.has(service.key)) {
      return true;
    }
  }
  return false;
}

function mentionsGroundedService(source: string, groundedServices: Set<string>): boolean {
  for (const service of SERVICE_PATTERNS) {
    if (groundedServices.has(service.key) && service.pattern.test(source)) {
      return true;
    }
  }
  return false;
}
