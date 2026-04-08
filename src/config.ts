import os from "node:os";
import path from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ quiet: true });

const envSchema = z.object({
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().min(1).default("qwen3.5"),
  // 코드 생성 전용 모델 — 코드 특화 모델을 쓰면 실제 전문성이 분리됨
  // 설정 안 하면 OLLAMA_MODEL과 동일하게 동작
  OLLAMA_CODEGEN_MODEL: z.string().min(1).optional(),
  AGENT_OUTPUT_DIR: z.string().optional(),
  MULTI_AGENT_PORT: z.coerce.number().int().min(1).max(65535).default(3030),
});

export const DEFAULT_EXAMPLE_REQUEST =
  "사용자가 제품 요구사항 문서를 업로드하고, AI와 함께 요구사항을 구체화한 뒤, 백엔드·프론트엔드·AI 구현 명세를 받을 수 있는 팀 협업 워크스페이스를 설계해줘.";

export type AppConfig = {
  cwd: string;
  outputDir: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  // 코드 생성 전용 모델. 설정 안 하면 ollamaModel과 동일
  ollamaCodegenModel: string;
  timeoutMs: number;
};

export type ServerConfig = AppConfig & {
  port: number;
};

export function resolveDefaultTargetDirectory(): string {
  return path.resolve(os.homedir(), "Desktop", "multi-agent-workspace");
}

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

  const ollamaModel = overrides?.ollamaModel ?? parsed.data.OLLAMA_MODEL;
  return {
    cwd,
    outputDir,
    ollamaBaseUrl: normalizeBaseUrl(overrides?.ollamaBaseUrl ?? parsed.data.OLLAMA_BASE_URL),
    ollamaModel,
    ollamaCodegenModel: parsed.data.OLLAMA_CODEGEN_MODEL ?? ollamaModel,
    timeoutMs: 120_000,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function loadServerConfig(
  overrides?: Partial<Pick<ServerConfig, "cwd" | "outputDir" | "ollamaBaseUrl" | "ollamaModel" | "port">>,
): ServerConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join(", ");
    throw new Error(message);
  }

  const cwd = path.resolve(overrides?.cwd ?? process.cwd());
  const appConfig = loadAppConfig({
    ...overrides,
    cwd,
    outputDir: overrides?.outputDir ?? parsed.data.AGENT_OUTPUT_DIR ?? path.resolve(cwd, ".multi-agent-output"),
  });
  return {
    ...appConfig,
    port: overrides?.port ?? parsed.data.MULTI_AGENT_PORT,
  };
}
