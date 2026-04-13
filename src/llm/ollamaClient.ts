import type { ZodType } from "zod";
import type { LLMClient } from "./llmClient.js";

type OllamaRole = "system" | "user" | "assistant";

export type OllamaChatMessage = {
  role: OllamaRole;
  content: string;
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  error?: string;
};

type OllamaClientOptions = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

export type StructuredGenerationOptions = {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<unknown>;
  conversationMessages?: OllamaChatMessage[];
  temperature?: number;
  numPredict?: number;
  maxRetries?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
};

export class OllamaClient implements LLMClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(args: OllamaClientOptions) {
    this.baseUrl = args.baseUrl;
    this.model = args.model;
    this.timeoutMs = args.timeoutMs;
  }

  getModelName(): string {
    return this.model;
  }

  async generateStructured<T>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: ZodType<T>;
    conversationMessages?: OllamaChatMessage[];
    temperature?: number;
    numPredict?: number;
    maxRetries?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
  }): Promise<T> {
    const maxRetries = args.maxRetries ?? 3;
    let retryPrompt = args.userPrompt;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const raw = await this.chat(
        [
          { role: "system", content: args.systemPrompt },
          ...(args.conversationMessages ?? []),
          { role: "user", content: retryPrompt },
        ],
        compactChatOptions({
          format: "json",
          temperature: args.temperature ?? 0.2,
          numPredict: args.numPredict ?? 700,
          topP: args.topP,
          topK: args.topK,
          repeatPenalty: args.repeatPenalty,
        }),
      );

      try {
        const json = extractJson(raw);
        return args.schema.parse(json);
      } catch (error) {
        lastError = error;
        retryPrompt = [
          args.userPrompt,
          "",
          "The previous response was invalid.",
          `Validation issue: ${stringifyError(error)}`,
          "If an array failed minimum length validation, add concrete non-duplicate items until the minimum is satisfied.",
          "Return valid JSON only. Do not include markdown fences, commentary, or extra keys.",
        ].join("\n");
      }
    }

    throw new Error(`Failed to generate structured output from Ollama: ${stringifyError(lastError)}`);
  }

  private async chat(
    messages: OllamaChatMessage[],
    options?: {
      format?: "json";
      temperature?: number;
      numPredict?: number;
      topP?: number;
      topK?: number;
      repeatPenalty?: number;
    },
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages,
        ...(options?.format ? { format: options.format } : {}),
        options: {
          temperature: options?.temperature ?? 0.2,
          num_predict: options?.numPredict ?? 700,
          ...(typeof options?.topP === "number" ? { top_p: options.topP } : {}),
          ...(typeof options?.topK === "number" ? { top_k: options.topK } : {}),
          ...(typeof options?.repeatPenalty === "number" ? { repeat_penalty: options.repeatPenalty } : {}),
        },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
    }

    const payload = (await response.json()) as OllamaChatResponse;
    const content = payload.message?.content?.trim();
    if (!content) {
      throw new Error(payload.error ?? "Ollama returned an empty response.");
    }
    return content;
  }
}

function extractJson(raw: string): unknown {
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fencedMatch = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? withoutThinking;
  return JSON.parse(candidate);
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function compactChatOptions(args: {
  format: "json";
  temperature: number;
  numPredict: number;
  topP: number | undefined;
  topK: number | undefined;
  repeatPenalty: number | undefined;
}): {
  format: "json";
  temperature: number;
  numPredict: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
} {
  return {
    format: args.format,
    temperature: args.temperature,
    numPredict: args.numPredict,
    ...(typeof args.topP === "number" ? { topP: args.topP } : {}),
    ...(typeof args.topK === "number" ? { topK: args.topK } : {}),
    ...(typeof args.repeatPenalty === "number" ? { repeatPenalty: args.repeatPenalty } : {}),
  };
}
