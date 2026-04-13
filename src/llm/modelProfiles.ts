export type GenerationStage =
  | "pm-initial"
  | "pm-final"
  | "clarification"
  | "discussion"
  | "spec"
  | "implementation-plan"
  | "build-brief"
  | "code-review"
  | "codegen";

export type StructuredGenerationProfile = {
  temperature: number;
  numPredict: number;
  maxRetries: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
};

type ModelFamily = "qwen" | "qwen-coder" | "deepseek" | "llama" | "gemma" | "mistral" | "generic";

const BASE_STAGE_PROFILES: Record<GenerationStage, StructuredGenerationProfile> = {
  "pm-initial": { temperature: 0.12, numPredict: 1200, maxRetries: 4, topP: 0.88, topK: 30, repeatPenalty: 1.02 },
  "pm-final": { temperature: 0.1, numPredict: 1600, maxRetries: 4, topP: 0.84, topK: 25, repeatPenalty: 1.04 },
  clarification: { temperature: 0.08, numPredict: 800, maxRetries: 4, topP: 0.8, topK: 20, repeatPenalty: 1.02 },
  discussion: { temperature: 0.12, numPredict: 1400, maxRetries: 4, topP: 0.88, topK: 30, repeatPenalty: 1.03 },
  spec: { temperature: 0.1, numPredict: 2000, maxRetries: 4, topP: 0.84, topK: 25, repeatPenalty: 1.04 },
  "implementation-plan": {
    temperature: 0.08,
    numPredict: 1800,
    maxRetries: 4,
    topP: 0.82,
    topK: 20,
    repeatPenalty: 1.04,
  },
  "build-brief": { temperature: 0.08, numPredict: 2000, maxRetries: 4, topP: 0.8, topK: 20, repeatPenalty: 1.05 },
  "code-review": { temperature: 0.08, numPredict: 1800, maxRetries: 4, topP: 0.8, topK: 20, repeatPenalty: 1.05 },
  codegen: { temperature: 0.06, numPredict: 3200, maxRetries: 3, topP: 0.76, topK: 20, repeatPenalty: 1.08 },
};

const FAMILY_OVERRIDES: Partial<Record<ModelFamily, Partial<Record<GenerationStage, Partial<StructuredGenerationProfile>>>>> =
  {
    qwen: {
      "pm-initial": { numPredict: 1400, maxRetries: 5, topP: 0.82, topK: 20 },
      "pm-final": { numPredict: 1800, maxRetries: 5, topP: 0.78, topK: 20 },
      clarification: { numPredict: 1000, maxRetries: 5, topP: 0.76, topK: 16 },
      discussion: { numPredict: 1600, maxRetries: 5, topP: 0.82, topK: 24 },
      spec: { numPredict: 2200, maxRetries: 5, topP: 0.78, topK: 20 },
      "implementation-plan": { numPredict: 2000, maxRetries: 5, topP: 0.78, topK: 18 },
      "build-brief": { numPredict: 2200, maxRetries: 5, topP: 0.76, topK: 18 },
      "code-review": { temperature: 0.08, numPredict: 2000, maxRetries: 5, topP: 0.76, topK: 18, repeatPenalty: 1.06 },
      // 파일 단위 생성으로 전환됐으므로 파일 하나당 충분한 토큰 확보
      codegen: { temperature: 0.05, numPredict: 4000, maxRetries: 4, topP: 0.72, topK: 18, repeatPenalty: 1.08 },
    },
    "qwen-coder": {
      "code-review": { temperature: 0.06, numPredict: 1100, maxRetries: 4, topP: 0.72, topK: 16, repeatPenalty: 1.08 },
      codegen: { temperature: 0.04, numPredict: 2200, maxRetries: 4, topP: 0.7, topK: 16, repeatPenalty: 1.12 },
      spec: { temperature: 0.08, numPredict: 1000, topP: 0.78, topK: 20 },
    },
    deepseek: {
      discussion: { temperature: 0.1, numPredict: 700, maxRetries: 4, topP: 0.75, topK: 20, repeatPenalty: 1.06 },
      spec: { temperature: 0.08, numPredict: 1100, maxRetries: 4, topP: 0.72, topK: 18, repeatPenalty: 1.08 },
      "code-review": { temperature: 0.06, numPredict: 1000, maxRetries: 4, topP: 0.7, topK: 18, repeatPenalty: 1.08 },
      codegen: { temperature: 0.04, numPredict: 2000, maxRetries: 3, topP: 0.68, topK: 16, repeatPenalty: 1.12 },
    },
    llama: {
      discussion: { temperature: 0.14, numPredict: 680, maxRetries: 4, topP: 0.9, topK: 35 },
      spec: { temperature: 0.12, numPredict: 1000, maxRetries: 4, topP: 0.88, topK: 30 },
      "code-review": { temperature: 0.1, numPredict: 960, maxRetries: 4, topP: 0.84, topK: 24, repeatPenalty: 1.06 },
      codegen: { temperature: 0.08, numPredict: 1900, maxRetries: 3, topP: 0.8, topK: 24, repeatPenalty: 1.08 },
    },
    gemma: {
      discussion: { temperature: 0.1, numPredict: 560, topP: 0.82, topK: 24 },
      spec: { temperature: 0.08, numPredict: 860, topP: 0.8, topK: 22 },
      "code-review": { temperature: 0.08, numPredict: 820, topP: 0.78, topK: 18, repeatPenalty: 1.06 },
      codegen: { temperature: 0.05, numPredict: 1500, topP: 0.72, topK: 18, repeatPenalty: 1.1 },
    },
    mistral: {
      discussion: { temperature: 0.14, numPredict: 600, topP: 0.9, topK: 32 },
      spec: { temperature: 0.12, numPredict: 940, topP: 0.86, topK: 28 },
      "code-review": { temperature: 0.1, numPredict: 900, topP: 0.82, topK: 22, repeatPenalty: 1.06 },
      codegen: { temperature: 0.07, numPredict: 1700, topP: 0.78, topK: 22, repeatPenalty: 1.08 },
    },
  };

export function resolveGenerationProfile(model: string, stage: GenerationStage): StructuredGenerationProfile {
  const family = detectModelFamily(model);
  const base = BASE_STAGE_PROFILES[stage];
  const override = FAMILY_OVERRIDES[family]?.[stage] ?? {};

  return {
    ...base,
    ...override,
  };
}

function detectModelFamily(model: string): ModelFamily {
  const normalized = model.toLowerCase();

  if (normalized.includes("coder") && normalized.includes("qwen")) {
    return "qwen-coder";
  }
  if (normalized.includes("qwen")) {
    return "qwen";
  }
  if (normalized.includes("deepseek")) {
    return "deepseek";
  }
  if (normalized.includes("llama")) {
    return "llama";
  }
  if (normalized.includes("gemma")) {
    return "gemma";
  }
  if (normalized.includes("mistral")) {
    return "mistral";
  }
  return "generic";
}
