import { z } from "zod";

export const buildBriefSchema = z
  .object({
    appName: z.string().min(1),
    appType: z.enum(["web-app", "mobile-web-app", "api", "fullstack-app"]),
    primaryGoal: z.string().min(1),
    targetUsers: z.array(z.string().min(1)).min(1).max(4),
    experiencePrinciples: z.array(z.string().min(1)).min(3).max(6),
    keyFeatures: z.array(z.string().min(1)).min(4).max(8),
    screens: z.array(z.string().min(1)).min(2).max(8),
    entities: z.array(z.string().min(1)).min(2).max(8),
    apiEndpoints: z.array(z.string().min(1)).max(10),
    stack: z.array(z.string().min(1)).min(2).max(6),
    fileLayout: z.array(z.string().min(1)).min(6).max(16),
    acceptanceChecks: z.array(z.string().min(1)).min(3).max(6),
    notes: z.array(z.string().min(1)).min(2).max(6),
  })
  .strict();

export const generatedCodeFileSchema = z
  .object({
    path: z.string().min(1).max(200),
    purpose: z.string().min(1).max(200),
    content: z.string().min(1),
  })
  .strict();

export const generatedCodePlanFileSchema = z
  .object({
    path: z.string().min(1).max(200),
    purpose: z.string().min(1).max(200),
  })
  .strict();

export const generatedCodePlanSchema = z
  .object({
    role: z.enum(["backend", "frontend", "ai", "infra", "test"]),
    summary: z.string().min(1),
    files: z.array(generatedCodePlanFileSchema).min(1).max(8),
    validation: z.array(z.string().min(1)).min(2).max(6),
  })
  .strict();

export const generatedCodeBundleSchema = z
  .object({
    role: z.enum(["backend", "frontend", "ai", "infra", "test"]),
    summary: z.string().min(1),
    files: z.array(generatedCodeFileSchema).min(1).max(8),
    validation: z.array(z.string().min(1)).min(2).max(6),
  })
  .strict();

export type BuildBrief = z.infer<typeof buildBriefSchema>;
export type GeneratedCodeFile = z.infer<typeof generatedCodeFileSchema>;
export type GeneratedCodePlanFile = z.infer<typeof generatedCodePlanFileSchema>;
export type GeneratedCodePlan = z.infer<typeof generatedCodePlanSchema>;
export type GeneratedCodeBundle = z.infer<typeof generatedCodeBundleSchema>;
