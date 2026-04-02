import type { ArtifactFileName, ChatMessage } from "./chat.js";
import type {
  AIDiscussion,
  AIFeaturesSpec,
  AgentReaction,
  BackendDiscussion,
  BackendSpec,
  FrontendDiscussion,
  FrontendSpec,
  ImplementationPlan,
  PMFinalDecision,
  PMInitialDiscussion,
} from "./contracts.js";

export type DiscussionBundle = {
  pmInitial: PMInitialDiscussion;
  backend: BackendDiscussion;
  frontend: FrontendDiscussion;
  ai: AIDiscussion;
  reactions: AgentReaction[];
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
  implementation: ImplementationPlan;
};

export type OrchestrationPhaseKey =
  | "user"
  | "pm-initial"
  | "discussion"
  | "pm-final"
  | "execution"
  | "implementation";

export type OrchestrationPhaseState = "pending" | "active" | "completed" | "failed";

export type OrchestrationPhaseUpdate = {
  key: OrchestrationPhaseKey;
  label: string;
  state: OrchestrationPhaseState;
  detail: string;
  timestamp: string;
};

export type OrchestrationHooks = {
  onMessage?: (message: ChatMessage) => void | Promise<void>;
  onPhase?: (phase: OrchestrationPhaseUpdate) => void | Promise<void>;
  onArtifacts?: (artifacts: GeneratedArtifact[]) => void | Promise<void>;
};

export type OrchestrationResult = {
  userRequest: string;
  transcript: ChatMessage[];
  discussion: DiscussionBundle;
  specs: GeneratedSpecs;
  artifacts: GeneratedArtifact[];
};
