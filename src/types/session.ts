import type { ChatMessage } from "./chat.js";
import type { OrchestrationPhaseKey, OrchestrationPhaseState } from "./orchestration.js";

export type SessionStatus = "queued" | "running" | "completed" | "failed";

export type SessionPhase = {
  key: OrchestrationPhaseKey;
  label: string;
  state: OrchestrationPhaseState;
  detail: string;
  timestamp: string | null;
};

export type SessionArtifact = {
  filename: string;
  url: string;
  content: string;
};

export type SessionSnapshot = {
  id: string;
  userRequest: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  transcript: ChatMessage[];
  phases: SessionPhase[];
  artifacts: SessionArtifact[];
  error?: string;
};

export type SessionEvent =
  | { type: "snapshot"; snapshot: SessionSnapshot }
  | { type: "message"; message: ChatMessage }
  | { type: "phase"; phase: SessionPhase }
  | { type: "artifacts"; artifacts: SessionArtifact[] }
  | { type: "status"; status: SessionStatus; error?: string };
