import type { ChatMessage } from "./chat.js";
import type { ClarificationQuestion } from "./contracts.js";
import type { ClarificationAnswer, CodeActivityUpdate, ProjectStartMode } from "./orchestration.js";
import type { OrchestrationPhaseKey, OrchestrationPhaseState } from "./orchestration.js";

export type SessionStatus = "queued" | "running" | "waiting_input" | "completed" | "failed";

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

export type SessionClarification = {
  summary: string;
  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
  state: "pending" | "answered";
};

export type SessionCodeActivity = CodeActivityUpdate;

export type SessionPreview = {
  status: "idle" | "starting" | "ready" | "failed";
  detail: string;
  url?: string;
  targetDirectory?: string;
  updatedAt: string;
};

export type SessionSnapshot = {
  id: string;
  userRequest: string;
  targetDirectory?: string;
  startMode: ProjectStartMode;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  transcript: ChatMessage[];
  phases: SessionPhase[];
  artifacts: SessionArtifact[];
  clarification?: SessionClarification;
  codeActivity?: SessionCodeActivity;
  preview?: SessionPreview;
  error?: string;
};

// Lightweight index entry persisted to disk — no transcript or artifacts
export type SessionSummary = {
  id: string;
  userRequest: string;
  targetDirectory?: string;
  startMode: ProjectStartMode;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type SessionEvent =
  | { type: "snapshot"; snapshot: SessionSnapshot }
  | { type: "message"; message: ChatMessage }
  | { type: "phase"; phase: SessionPhase }
  | { type: "artifacts"; artifacts: SessionArtifact[] }
  | { type: "clarification"; clarification?: SessionClarification }
  | { type: "code_activity"; codeActivity?: SessionCodeActivity }
  | { type: "preview"; preview?: SessionPreview }
  | { type: "status"; status: SessionStatus; error?: string };
