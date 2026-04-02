import path from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ quiet: true });

const envSchema = z.object({
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen3"),
  AGENT_OUTPUT_DIR: z.string().optional(),
});

export const DEFAULT_EXAMPLE_REQUEST =
  "Build a team workspace where users can upload product requirement documents, discuss them with AI, and receive implementation-ready specs for web and backend delivery.";

export type AppConfig = {
  cwd: string;
  outputDir: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  timeoutMs: number;
};

export function loadAppConfig(
  overrides?: Partial<Pick<AppConfig, "cwd" | "outputDir" | "ollamaBaseUrl" | "ollamaModel">>,
): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new Error(message);
  }

  const cwd = path.resolve(overrides?.cwd ?? process.cwd());
  const outputDir = path.resolve(overrides?.outputDir ?? parsed.data.AGENT_OUTPUT_DIR ?? cwd);

  return {
    cwd,
    outputDir,
    ollamaBaseUrl: normalizeBaseUrl(overrides?.ollamaBaseUrl ?? parsed.data.OLLAMA_BASE_URL),
    ollamaModel: overrides?.ollamaModel ?? parsed.data.OLLAMA_MODEL,
    timeoutMs: 120_000,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}
