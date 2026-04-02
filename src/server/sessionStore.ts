import { randomUUID } from "node:crypto";

import type { ChatMessage } from "../types/chat.js";
import type { ClarificationPlan } from "../types/contracts.js";
import type {
  ClarificationAnswer,
  CodeActivityUpdate,
  GeneratedArtifact,
  OrchestrationPhaseKey,
  OrchestrationPhaseUpdate,
} from "../types/orchestration.js";
import type {
  SessionArtifact,
  SessionClarification,
  SessionCodeActivity,
  SessionEvent,
  SessionPhase,
  SessionSnapshot,
  SessionStatus,
} from "../types/session.js";

const DEFAULT_PHASES: Array<{ key: OrchestrationPhaseKey; label: string }> = [
  { key: "user", label: "사용자 요청" },
  { key: "pm-initial", label: "PM 문제 정의" },
  { key: "discussion", label: "자유 토론" },
  { key: "clarification", label: "추가 확인" },
  { key: "pm-final", label: "PM 최종 결정" },
  { key: "execution", label: "명세 산출물" },
  { key: "implementation", label: "구현 실행 계획" },
  { key: "coding", label: "코드 구현" },
];

type PendingClarification = {
  resolve: (answers: ClarificationAnswer[]) => void;
};

type SessionRecord = {
  snapshot: SessionSnapshot;
  listeners: Set<(event: SessionEvent) => void>;
  pendingClarification?: PendingClarification;
};

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  createSession(userRequest: string, targetDirectory?: string): SessionSnapshot {
    const now = new Date().toISOString();
    const id = randomUUID();
    const snapshot: SessionSnapshot = {
      id,
      userRequest,
      ...(targetDirectory ? { targetDirectory } : {}),
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
    } else if (status !== "failed") {
      delete record.snapshot.error;
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

  markActivePhaseFailed(id: string, detail: string): void {
    const record = this.requireRecord(id);
    const phase = [...record.snapshot.phases].reverse().find((item) => item.state === "active");
    if (!phase) {
      return;
    }

    phase.state = "failed";
    phase.detail = detail;
    phase.timestamp = new Date().toISOString();
    record.snapshot.updatedAt = phase.timestamp;

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

  setCodeActivity(id: string, update: CodeActivityUpdate): void {
    const record = this.requireRecord(id);
    record.snapshot.codeActivity = { ...update };
    record.snapshot.updatedAt = new Date().toISOString();

    this.emit(id, {
      type: "code_activity",
      codeActivity: this.cloneCodeActivity(record.snapshot.codeActivity),
    });
  }

  getArtifact(id: string, filename: string): SessionArtifact | undefined {
    const record = this.sessions.get(id);
    return record?.snapshot.artifacts.find((artifact) => artifact.filename === filename);
  }

  requestClarification(id: string, plan: ClarificationPlan): Promise<ClarificationAnswer[]> {
    const record = this.requireRecord(id);
    if (record.pendingClarification) {
      throw new Error("이미 답변 대기 중인 질문이 있습니다.");
    }

    const clarification: SessionClarification = {
      summary: plan.summary,
      questions: plan.questions,
      answers: [],
      state: "pending",
    };

    record.snapshot.clarification = clarification;
    record.snapshot.updatedAt = new Date().toISOString();

    this.emit(id, {
      type: "clarification",
      clarification: this.cloneClarification(clarification),
    });

    return new Promise<ClarificationAnswer[]>((resolve) => {
      record.pendingClarification = { resolve };
    });
  }

  submitClarificationAnswers(id: string, answers: ClarificationAnswer[]): SessionSnapshot {
    const record = this.requireRecord(id);
    const pending = record.pendingClarification;
    const clarification = record.snapshot.clarification;

    if (!pending || !clarification || clarification.state !== "pending") {
      throw new Error("현재 답변 대기 중인 질문이 없습니다.");
    }

    clarification.answers = answers.map((item) => ({ ...item }));
    clarification.state = "answered";
    record.snapshot.updatedAt = new Date().toISOString();
    delete record.pendingClarification;

    this.emit(id, {
      type: "clarification",
      clarification: this.cloneClarification(clarification),
    });

    pending.resolve(answers.map((item) => ({ ...item })));
    return this.cloneSnapshot(record.snapshot);
  }

  private requireRecord(id: string): SessionRecord {
    const record = this.sessions.get(id);
    if (!record) {
      throw new Error(`존재하지 않는 세션입니다: ${id}`);
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
      ...(snapshot.clarification ? { clarification: this.cloneClarification(snapshot.clarification) } : {}),
      ...(snapshot.codeActivity ? { codeActivity: this.cloneCodeActivity(snapshot.codeActivity) } : {}),
    };
  }

  private cloneClarification(clarification: SessionClarification): SessionClarification {
    return {
      ...clarification,
      questions: clarification.questions.map((question) => ({ ...question })),
      answers: clarification.answers.map((answer) => ({ ...answer })),
    };
  }

  private cloneCodeActivity(codeActivity: SessionCodeActivity): SessionCodeActivity {
    return {
      ...codeActivity,
      files: codeActivity.files.map((item) => item),
      writtenFiles: codeActivity.writtenFiles.map((item) => item),
    };
  }
}
