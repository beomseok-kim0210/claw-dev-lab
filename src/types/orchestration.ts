import type { AgentRole, ArtifactFileName, ChatMessage } from "./chat.js";
import type {
  AIDiscussion,
  AIFeaturesSpec,
  AgentReaction,
  BackendDiscussion,
  BackendSpec,
  ClarificationPlan,
  ClarificationQuestion,
  FrontendDiscussion,
  FrontendSpec,
  ImplementationPlan,
  InfraDiscussion,
  InfraSpec,
  PMFinalDecision,
  PMInitialDiscussion,
} from "./contracts.js";
import type { BuildBrief } from "./generation.js";

export type ClarificationAnswer = {
  questionId: ClarificationQuestion["id"];
  answer: string;
};

export type ClarificationExchange = {
  summary: string;
  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
};

export type DiscussionBundle = {
  pmInitial: PMInitialDiscussion;
  backend: BackendDiscussion;
  frontend: FrontendDiscussion;
  ai: AIDiscussion;
  infra: InfraDiscussion;
  reactions: AgentReaction[];
  clarification?: ClarificationExchange;
  pmFinal: PMFinalDecision;
};

export type GeneratedArtifact = {
  filename: ArtifactFileName;
  absolutePath: string;
  content: string;
};

export type GeneratedSpecs = {
  backend: BackendSpec;
  frontend: FrontendSpec;
  ai: AIFeaturesSpec;
  infra: InfraSpec;
  implementation: ImplementationPlan;
  buildBrief: BuildBrief;
};

export type OrchestrationPhaseKey =
  | "user"
  | "pm-initial"
  | "discussion"
  | "clarification"
  | "pm-final"
  | "execution"
  | "implementation"
  | "coding";

export type OrchestrationPhaseState = "pending" | "active" | "completed" | "failed";

export type OrchestrationPhaseUpdate = {
  key: OrchestrationPhaseKey;
  label: string;
  state: OrchestrationPhaseState;
  detail: string;
  timestamp: string;
};

export type CodeActivityUpdate = {
  owner: Exclude<AgentRole, "pm">;
  targetDirectory: string;
  files: string[];
  writtenFiles: string[];
  currentFile: string | null;
  state: "queued" | "writing" | "completed";
  timestamp: string;
};

export type OrchestrationHooks = {
  onMessage?: (message: ChatMessage) => void | Promise<void>;
  onPhase?: (phase: OrchestrationPhaseUpdate) => void | Promise<void>;
  onArtifacts?: (artifacts: GeneratedArtifact[]) => void | Promise<void>;
  onCodeActivity?: (update: CodeActivityUpdate) => void | Promise<void>;
  onClarificationRequest?: (plan: ClarificationPlan) => Promise<ClarificationAnswer[]>;
};

export type OrchestrationResult = {
  userRequest: string;
  transcript: ChatMessage[];
  discussion: DiscussionBundle;
  specs: GeneratedSpecs;
  artifacts: GeneratedArtifact[];
};
