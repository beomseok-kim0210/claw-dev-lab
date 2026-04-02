import type { ArtifactFileName, ChatMessage } from "./chat.js";
import type {
  AIDiscussion,
  AIFeaturesSpec,
  BackendDiscussion,
  BackendSpec,
  FrontendDiscussion,
  FrontendSpec,
  PMFinalDecision,
  PMInitialDiscussion,
} from "./contracts.js";

export type DiscussionBundle = {
  pmInitial: PMInitialDiscussion;
  backend: BackendDiscussion;
  frontend: FrontendDiscussion;
  ai: AIDiscussion;
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
};

export type OrchestrationPhaseKey =
  | "user"
  | "pm-initial"
  | "backend"
  | "frontend"
  | "ai"
  | "pm-final"
  | "execution";

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
