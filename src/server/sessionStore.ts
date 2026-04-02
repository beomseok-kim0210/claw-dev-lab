import { randomUUID } from "node:crypto";

import type { GeneratedArtifact } from "../types/orchestration.js";
import type { SessionArtifact, SessionEvent, SessionPhase, SessionSnapshot, SessionStatus } from "../types/session.js";
import type { ChatMessage } from "../types/chat.js";
import type { OrchestrationPhaseKey, OrchestrationPhaseUpdate } from "../types/orchestration.js";

const DEFAULT_PHASES: Array<{ key: OrchestrationPhaseKey; label: string }> = [
  { key: "user", label: "사용자 요청" },
  { key: "pm-initial", label: "PM 문제 정의" },
  { key: "backend", label: "백엔드 검토" },
  { key: "frontend", label: "프론트엔드 검토" },
  { key: "ai", label: "AI 검토" },
  { key: "pm-final", label: "PM 최종 결정" },
  { key: "execution", label: "명세 산출물" },
  { key: "implementation", label: "구현 실행 계획" },
];

type SessionRecord = {
  snapshot: SessionSnapshot;
  listeners: Set<(event: SessionEvent) => void>;
};

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  createSession(userRequest: string): SessionSnapshot {
    const now = new Date().toISOString();
    const id = randomUUID();
    const snapshot: SessionSnapshot = {
      id,
      userRequest,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      transcript: [],
      phases: DEFAULT_PHASES.map(
        (phase): SessionPhase => ({
          key: phase.key,
          label: phase.label,
          state: "pending",
          detail: "",
          timestamp: null,
        }),
      ),
      artifacts: [],
    };

    this.sessions.set(id, {
      snapshot,
      listeners: new Set(),
    });

    return this.cloneSnapshot(snapshot);
  }

  getSession(id: string): SessionSnapshot | undefined {
    const record = this.sessions.get(id);
    return record ? this.cloneSnapshot(record.snapshot) : undefined;
  }

  subscribe(id: string, listener: (event: SessionEvent) => void): (() => void) | undefined {
    const record = this.sessions.get(id);
    if (!record) {
      return undefined;
    }

    record.listeners.add(listener);
    return () => {
      record.listeners.delete(listener);
    };
  }

  setStatus(id: string, status: SessionStatus, error?: string): void {
    const record = this.requireRecord(id);
    record.snapshot.status = status;
    record.snapshot.updatedAt = new Date().toISOString();

    if (error !== undefined) {
      record.snapshot.error = error;
    }

    this.emit(id, {
      type: "status",
      status,
      ...(error !== undefined ? { error } : {}),
    });
  }

  appendMessage(id: string, message: ChatMessage): void {
    const record = this.requireRecord(id);
    record.snapshot.transcript.push(message);
    record.snapshot.updatedAt = new Date().toISOString();
    this.emit(id, {
      type: "message",
      message,
    });
  }

  updatePhase(id: string, update: OrchestrationPhaseUpdate): void {
    const record = this.requireRecord(id);
    const phase = record.snapshot.phases.find((item) => item.key === update.key);
    if (!phase) {
      return;
    }

    phase.state = update.state;
    phase.detail = update.detail;
    phase.timestamp = update.timestamp;
    record.snapshot.updatedAt = new Date().toISOString();

    this.emit(id, {
      type: "phase",
      phase: { ...phase },
    });
  }

  setArtifacts(id: string, artifacts: GeneratedArtifact[]): void {
    const record = this.requireRecord(id);
    const mappedArtifacts: SessionArtifact[] = artifacts.map((artifact) => ({
      filename: artifact.filename,
      url: `/api/sessions/${id}/artifacts/${encodeURIComponent(artifact.filename)}`,
      content: artifact.content,
    }));

    record.snapshot.artifacts = mappedArtifacts;
    record.snapshot.updatedAt = new Date().toISOString();

    this.emit(id, {
      type: "artifacts",
      artifacts: mappedArtifacts.map((artifact) => ({ ...artifact })),
    });
  }

  getArtifact(id: string, filename: string): SessionArtifact | undefined {
    const record = this.sessions.get(id);
    return record?.snapshot.artifacts.find((artifact) => artifact.filename === filename);
  }

  private requireRecord(id: string): SessionRecord {
    const record = this.sessions.get(id);
    if (!record) {
      throw new Error(`알 수 없는 세션입니다: ${id}`);
    }
    return record;
  }

  private emit(id: string, event: SessionEvent): void {
    const record = this.requireRecord(id);
    for (const listener of record.listeners) {
      listener(event);
    }
  }

  private cloneSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
    return {
      ...snapshot,
      transcript: snapshot.transcript.map((message) => ({ ...message })),
      phases: snapshot.phases.map((phase) => ({ ...phase })),
      artifacts: snapshot.artifacts.map((artifact) => ({ ...artifact })),
    };
  }
}
