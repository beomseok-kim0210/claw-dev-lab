import { z } from "zod";

const messageReferenceSchema = z.string().regex(/^msg-\d{3}$/);
const shortBulletListSchema = z.array(z.string().min(1)).min(2).max(5);
const mediumBulletListSchema = z.array(z.string().min(1)).min(3).max(6);
const referenceListSchema = z.array(messageReferenceSchema).min(1).max(5);

export const pmInitialDiscussionSchema = z
  .object({
    headline: z.string().min(1),
    problemStatement: z.string().min(1),
    mvpGoals: shortBulletListSchema,
    successCriteria: shortBulletListSchema,
    references: referenceListSchema,
  })
  .strict();

const agentDiscussionBaseSchema = z
  .object({
    headline: z.string().min(1),
    summary: z.string().min(1),
    claim: z.string().min(1),
    support: shortBulletListSchema,
    rebuttalTarget: z.union([messageReferenceSchema, z.literal("없음")]),
    rebuttal: z.string().min(1),
    references: referenceListSchema,
  })
  .strict();

export const backendDiscussionSchema = agentDiscussionBaseSchema
  .extend({
    apiDesign: mediumBulletListSchema,
    dataModel: shortBulletListSchema,
    constraints: shortBulletListSchema,
  })
  .strict();

export const frontendDiscussionSchema = agentDiscussionBaseSchema
  .extend({
    screens: mediumBulletListSchema,
    components: mediumBulletListSchema,
    usabilityNotes: shortBulletListSchema,
  })
  .strict();

export const aiDiscussionSchema = agentDiscussionBaseSchema
  .extend({
    aiFeatures: mediumBulletListSchema,
    feasibility: shortBulletListSchema,
    risks: shortBulletListSchema,
  })
  .strict();

export const agentReactionSchema = z
  .object({
    headline: z.string().min(1),
    reactionType: z.enum(["challenge", "support", "refine"]),
    targetMessageId: messageReferenceSchema,
    position: z.string().min(1),
    reaction: z.string().min(1),
    adjustment: z.string().min(1),
    references: referenceListSchema,
  })
  .strict();

export const pmFinalDecisionSchema = z
  .object({
    headline: z.string().min(1),
    summary: z.string().min(1),
    mvpScope: mediumBulletListSchema,
    nonGoals: shortBulletListSchema,
    deliveryPlan: shortBulletListSchema,
    finalDecision: z.string().min(1),
    references: referenceListSchema,
  })
  .strict();

const codeExampleSchema = (languages: readonly [string, ...string[]]) =>
  z
    .object({
      language: z.enum(languages),
      snippet: z.string().min(1),
    })
    .strict();

export const backendSpecSchema = z
  .object({
    overview: z.string().min(1),
    apiDesign: mediumBulletListSchema,
    dataModel: mediumBulletListSchema,
    constraints: shortBulletListSchema,
    implementationSteps: mediumBulletListSchema,
    exampleCode: codeExampleSchema(["ts", "sql", "json"]),
  })
  .strict();

export const frontendSpecSchema = z
  .object({
    overview: z.string().min(1),
    screens: mediumBulletListSchema,
    components: mediumBulletListSchema,
    usabilityChecklist: shortBulletListSchema,
    implementationSteps: mediumBulletListSchema,
    exampleCode: codeExampleSchema(["tsx", "ts", "json", "css"]),
  })
  .strict();

export const aiFeaturesSpecSchema = z
  .object({
    overview: z.string().min(1),
    features: mediumBulletListSchema,
    feasibilityNotes: shortBulletListSchema,
    guardrails: shortBulletListSchema,
    implementationSteps: mediumBulletListSchema,
    exampleCode: codeExampleSchema(["ts", "json", "md"]),
  })
  .strict();

const implementationTaskSchema = z
  .object({
    id: z.string().regex(/^task-\d{2}$/),
    title: z.string().min(1),
    owner: z.enum(["pm", "backend", "frontend", "ai"]),
    goal: z.string().min(1),
    deliverables: shortBulletListSchema,
    acceptanceCriteria: shortBulletListSchema,
  })
  .strict();

export const implementationPlanSchema = z
  .object({
    overview: z.string().min(1),
    milestones: shortBulletListSchema,
    tasks: z.array(implementationTaskSchema).min(4).max(4),
    validationChecklist: shortBulletListSchema,
    kickoffPrompt: z.string().min(1),
  })
  .strict();

export type PMInitialDiscussion = z.infer<typeof pmInitialDiscussionSchema>;
export type BackendDiscussion = z.infer<typeof backendDiscussionSchema>;
export type FrontendDiscussion = z.infer<typeof frontendDiscussionSchema>;
export type AIDiscussion = z.infer<typeof aiDiscussionSchema>;
export type AgentReaction = z.infer<typeof agentReactionSchema>;
export type PMFinalDecision = z.infer<typeof pmFinalDecisionSchema>;
export type BackendSpec = z.infer<typeof backendSpecSchema>;
export type FrontendSpec = z.infer<typeof frontendSpecSchema>;
export type AIFeaturesSpec = z.infer<typeof aiFeaturesSpecSchema>;
export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
