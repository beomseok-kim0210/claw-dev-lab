import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import type { LLMClient, StructuredGenerationArgs } from "./llmClient.js";

type GeminiClientOptions = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
};

export class GeminiClient implements LLMClient {
  private readonly client: GoogleGenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(args: GeminiClientOptions) {
    this.client = new GoogleGenAI({ apiKey: args.apiKey });
    this.model = args.model;
    this.timeoutMs = args.timeoutMs ?? 120_000;
  }

  getModelName(): string {
    return this.model;
  }

  async generateStructured<T>(args: StructuredGenerationArgs<T>): Promise<T> {
    const maxRetries = args.maxRetries ?? 3;
    let retryPrompt = args.userPrompt;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const raw = await this.chat(args.systemPrompt, retryPrompt, args.conversationMessages, {
        temperature: args.temperature ?? 0.2,
        maxOutputTokens: args.numPredict ?? 2000,
        ...(typeof args.topP === "number" ? { topP: args.topP } : {}),
        ...(typeof args.topK === "number" ? { topK: args.topK } : {}),
      });

      try {
        const json = extractJson(raw);
        return args.schema.parse(json);
      } catch (error) {
        lastError = error;
        retryPrompt = [
          args.userPrompt,
          "",
          "The previous response was invalid.",
          `Validation issue: ${error instanceof Error ? error.message : String(error)}`,
          "If an array failed minimum length validation, add concrete non-duplicate items until the minimum is satisfied.",
          "Return valid JSON only. Do not include markdown fences, commentary, or extra keys.",
        ].join("\n");
      }
    }

    throw new Error(`Failed to generate structured output from Gemini: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }

  private async chat(
    systemPrompt: string,
    userPrompt: string,
    conversationMessages?: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
      topP?: number;
      topK?: number;
    },
  ): Promise<string> {
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    if (conversationMessages) {
      for (const msg of conversationMessages) {
        if (msg.role === "system") continue;
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: userPrompt }],
    });

    const response = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxOutputTokens ?? 2000,
        responseMimeType: "application/json",
        ...(typeof options?.topP === "number" ? { topP: options.topP } : {}),
        ...(typeof options?.topK === "number" ? { topK: options.topK } : {}),
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }
    return text;
  }
}

function extractJson(raw: string): unknown {
  const withoutThinking = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const fencedMatch = withoutThinking.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? withoutThinking;
  return JSON.parse(candidate);
}
