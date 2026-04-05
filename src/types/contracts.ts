import { z } from "zod";

const messageReferenceSchema = z.string().regex(/^msg-\d{3}$/);
const shortBulletListSchema = z.array(z.string().min(1)).min(2).max(5);
const mediumBulletListSchema = z.array(z.string().min(1)).min(3).max(6);
const referenceListSchema = z.array(messageReferenceSchema).min(1).max(6);

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

export const infraDiscussionSchema = agentDiscussionBaseSchema
  .extend({
    deploymentTopology: mediumBulletListSchema,
    environments: shortBulletListSchema,
    observability: shortBulletListSchema,
  })
  .strict();

export const testDiscussionSchema = agentDiscussionBaseSchema
  .extend({
    testApproach: mediumBulletListSchema,
    coverageFocus: shortBulletListSchema,
    qualityRisks: shortBulletListSchema,
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

export const clarificationQuestionSchema = z
  .object({
    id: z.string().regex(/^clarify-\d{2}$/),
    askedBy: z.enum(["pm", "backend", "frontend", "ai", "infra", "test"]),
    topic: z.enum(["scope", "api", "data", "ui", "ai", "infra", "test", "credential", "auth", "integration", "approval"]),
    question: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

export const clarificationPlanSchema = z
  .object({
    needsInput: z.boolean(),
    summary: z.string().min(1),
    questions: z.array(clarificationQuestionSchema).max(3),
  })
  .strict();

export const pmFinalDecisionSchema = z
  .object({
    headline: z.string().min(1),
    summary: z.string().min(1),
    mvpScope: mediumBulletListSchema,
    nonGoals: shortBulletListSchema,
    deliveryPlan: mediumBulletListSchema,
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

export const infraSpecSchema = z
  .object({
    overview: z.string().min(1),
    deploymentTopology: mediumBulletListSchema,
    environments: mediumBulletListSchema,
    operationsChecklist: shortBulletListSchema,
    implementationSteps: mediumBulletListSchema,
    exampleCode: codeExampleSchema(["yaml", "dockerfile", "sh", "json"]),
  })
  .strict();

export const testSpecSchema = z
  .object({
    overview: z.string().min(1),
    testStrategy: mediumBulletListSchema,
    testScenarios: mediumBulletListSchema,
    qualityGates: shortBulletListSchema,
    implementationSteps: mediumBulletListSchema,
    exampleCode: codeExampleSchema(["js", "ts", "md"]),
  })
  .strict();

const implementationTaskSchema = z
  .object({
    id: z.string().regex(/^task-\d{2}$/),
    title: z.string().min(1),
    owner: z.enum(["pm", "backend", "frontend", "ai", "infra", "test"]),
    goal: z.string().min(1),
    deliverables: shortBulletListSchema,
    acceptanceCriteria: shortBulletListSchema,
  })
  .strict();

export const implementationPlanSchema = z
  .object({
    overview: z.string().min(1),
    milestones: mediumBulletListSchema,
    tasks: z.array(implementationTaskSchema).min(6).max(6),
    validationChecklist: shortBulletListSchema,
    kickoffPrompt: z.string().min(1),
  })
  .strict();

export const implementationUpdateSchema = z
  .object({
    headline: z.string().min(1),
    taskId: z.string().regex(/^task-\d{2}$/),
    objective: z.string().min(1),
    targetFiles: z.array(z.string().min(1)).min(1).max(8),
    worklog: shortBulletListSchema,
    validation: shortBulletListSchema,
    references: referenceListSchema,
  })
  .strict();

export const implementationReviewSchema = z
  .object({
    headline: z.string().min(1),
    reactionType: z.enum(["challenge", "support", "refine"]),
    targetMessageId: messageReferenceSchema,
    targetFiles: z.array(z.string().min(1)).min(1).max(8),
    approvedAreas: z.array(z.string().min(1)).min(1).max(5),
    findings: z.array(z.string().min(1)).min(1).max(5),
    assessment: z.string().min(1),
    adjustment: z.string().min(1),
    references: referenceListSchema,
  })
  .strict();

export type PMInitialDiscussion = z.infer<typeof pmInitialDiscussionSchema>;
export type BackendDiscussion = z.infer<typeof backendDiscussionSchema>;
export type FrontendDiscussion = z.infer<typeof frontendDiscussionSchema>;
export type AIDiscussion = z.infer<typeof aiDiscussionSchema>;
export type InfraDiscussion = z.infer<typeof infraDiscussionSchema>;
export type TestDiscussion = z.infer<typeof testDiscussionSchema>;
export type AgentReaction = z.infer<typeof agentReactionSchema>;
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type ClarificationPlan = z.infer<typeof clarificationPlanSchema>;
export type PMFinalDecision = z.infer<typeof pmFinalDecisionSchema>;
export type BackendSpec = z.infer<typeof backendSpecSchema>;
export type FrontendSpec = z.infer<typeof frontendSpecSchema>;
export type AIFeaturesSpec = z.infer<typeof aiFeaturesSpecSchema>;
export type InfraSpec = z.infer<typeof infraSpecSchema>;
export type TestSpec = z.infer<typeof testSpecSchema>;
export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
export type ImplementationUpdate = z.infer<typeof implementationUpdateSchema>;
export type ImplementationReview = z.infer<typeof implementationReviewSchema>;
