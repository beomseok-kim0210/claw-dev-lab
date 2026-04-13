import type { ZodType } from "zod";

/**
 * LLM 클라이언트 공통 인터페이스.
 * OllamaClient, GeminiClient 등이 이 인터페이스를 구현한다.
 */
export type StructuredGenerationArgs<T = unknown> = {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  conversationMessages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  numPredict?: number;
  maxRetries?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
};

export interface LLMClient {
  getModelName(): string;
  generateStructured<T>(args: StructuredGenerationArgs<T>): Promise<T>;
}

/**
 * 1차 클라이언트 실패 시 폴백 클라이언트로 자동 전환.
 * API 쿼터 소진, 네트워크 오류 등에서 로컬 모델로 폴백한다.
 */
export class FallbackLLMClient implements LLMClient {
  private primaryExhausted = false;
  private consecutiveFailures = 0;
  private static readonly EXHAUSTION_THRESHOLD = 3;

  constructor(
    private readonly primary: LLMClient,
    private readonly fallback: LLMClient,
    private readonly onFallback?: (reason: string) => void,
  ) {}

  getModelName(): string {
    if (this.primaryExhausted) {
      return `${this.fallback.getModelName()} (fallback)`;
    }
    return this.primary.getModelName();
  }

  async generateStructured<T>(args: StructuredGenerationArgs<T>): Promise<T> {
    if (this.primaryExhausted) {
      return this.fallback.generateStructured(args);
    }

    try {
      const result = await this.primary.generateStructured(args);
      this.consecutiveFailures = 0;
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const isQuotaError = isQuotaOrRateLimitError(reason);

      this.consecutiveFailures += 1;

      if (isQuotaError || this.consecutiveFailures >= FallbackLLMClient.EXHAUSTION_THRESHOLD) {
        this.primaryExhausted = true;
        const msg = isQuotaError
          ? `API 쿼터 소진 감지 — 로컬 모델로 전환합니다: ${reason}`
          : `연속 ${this.consecutiveFailures}회 실패 — 로컬 모델로 전환합니다: ${reason}`;
        this.onFallback?.(msg);
      } else {
        this.onFallback?.(`Primary LLM 실패, 이번 요청만 폴백 처리: ${reason}`);
      }

      return this.fallback.generateStructured(args);
    }
  }
}

function isQuotaOrRateLimitError(message: string): boolean {
  const patterns = [
    /quota/i,
    /rate.?limit/i,
    /resource.?exhausted/i,
    /429/,
    /too many requests/i,
    /billing/i,
    /exceeded/i,
  ];
  return patterns.some((pattern) => pattern.test(message));
}
