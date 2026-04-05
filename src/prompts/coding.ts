import type { AgentRole, ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import type { GeneratedArtifact, VerificationCheck } from "../types/orchestration.js";
import { buildHarnessPrompt } from "./shared.js";

type CodingRole = Exclude<AgentRole, "pm">;

export function buildImplementationReviewPrompt(args: {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
  targetFiles: string[];
  generatedArtifacts: GeneratedArtifact[];
  verificationChecks: VerificationCheck[];
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective: `${roleLabel(args.role)} must review a concrete code bundle from another agent and decide whether it should pass, revise, or block.`,
    responsibilities: [
      "Read the target message, the actual file contents, and the verification results together.",
      "Prefer concrete engineering findings over vague style commentary.",
      "Use challenge only when there is a blocking problem, refine for smaller follow-ups, and support when the bundle is ready to move on.",
    ],
    userRequest: args.userRequest,
    messages: args.messages.slice(-12),
    contextBlocks: [
      {
        title: "Target Message",
        lines: [
          `[${args.targetMessage.id}] ${args.targetMessage.speaker} (${args.targetMessage.role})`,
          args.targetMessage.content,
        ],
      },
      {
        title: "Reviewed Files",
        lines: args.targetFiles.map((item) => `- ${item}`),
      },
      {
        title: "Generated File Contents",
        lines: renderArtifactContents(args.generatedArtifacts),
      },
      {
        title: "Verification Results",
        lines: renderVerificationChecks(args.verificationChecks),
      },
    ],
    contract: {
      schemaLines: [
        '  "headline": "짧은 코드 리뷰 제목",',
        '  "reactionType": "refine",',
        `  "targetMessageId": "${args.targetMessage.id}",`,
        '  "targetFiles": ["src/server.ts"],',
        '  "approvedAreas": ["좋은 점 1"],',
        '  "findings": ["Blocking: ... 또는 Follow-up: ..."],',
        '  "assessment": "리뷰 결론",',
        '  "adjustment": "다음 수정 지시",',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "approvedAreas 는 최소 1개 이상 작성한다.",
        "findings 는 실제 코드나 검증 결과에 근거한 내용만 작성한다.",
        "blocking 이 없으면 challenge 를 쓰지 않는다.",
        "코드가 이미 만족하면 support 와 함께 남길 수 있는 확인 사항만 적는다.",
      ],
    },
  });
}

export function buildImplementationUpdatePrompt(args: {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  task: ImplementationPlan["tasks"][number];
  targetFiles: string[];
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective: `${roleLabel(args.role)} must announce what code it is about to change and why.`,
    responsibilities: [
      "Keep the implementation update concrete and file-level.",
      "Stay inside the assigned task boundary.",
      "Write a short validation plan that another reviewer can check immediately.",
    ],
    userRequest: args.userRequest,
    messages: args.messages.slice(-10),
    contextBlocks: [
      {
        title: "Assigned Task",
        lines: [
          `- taskId: ${args.task.id}`,
          `- title: ${args.task.title}`,
          `- goal: ${args.task.goal}`,
          ...args.task.deliverables.map((item) => `- deliverable: ${item}`),
          ...args.task.acceptanceCriteria.map((item) => `- acceptance: ${item}`),
        ],
      },
      {
        title: "Target Files",
        lines: args.targetFiles.map((item) => `- ${item}`),
      },
    ],
    contract: {
      schemaLines: [
        '  "headline": "짧은 구현 시작 제목",',
        `  "taskId": "${args.task.id}",`,
        '  "objective": "이번 구현의 목적",',
        '  "targetFiles": ["src/server.ts"],',
        '  "worklog": ["무엇을 왜 바꾸는지 1", "무엇을 왜 바꾸는지 2"],',
        '  "validation": ["검증 항목 1", "검증 항목 2"],',
        '  "references": ["msg-001"]',
      ],
      constraints: [
        "targetFiles 는 전달받은 파일 목록만 사용한다.",
        "worklog 는 코드 수준의 작업 설명이어야 한다.",
        "validation 은 실제 체크 가능한 형태로 쓴다.",
      ],
    },
  });
}

function renderArtifactContents(artifacts: GeneratedArtifact[]): string[] {
  return artifacts.slice(0, 6).flatMap((artifact) => [
    `- file: ${artifact.filename}`,
    ...artifact.content
      .split(/\r?\n/u)
      .slice(0, 160)
      .map((line) => `  ${line}`),
  ]);
}

function renderVerificationChecks(checks: VerificationCheck[]): string[] {
  if (checks.length === 0) {
    return ["- No verification check was executed."];
  }

  return checks.flatMap((check) => [
    `- status: ${check.status}`,
    `  name: ${check.name}`,
    `  command: ${check.command}`,
    `  summary: ${check.summary}`,
    ...(check.outputSnippet ? check.outputSnippet.split(/\r?\n/u).slice(0, 40).map((line) => `  ${line}`) : []),
  ]);
}

function roleLabel(role: CodingRole): string {
  if (role === "backend") {
    return "Backend";
  }
  if (role === "frontend") {
    return "Frontend";
  }
  if (role === "infra") {
    return "Infra";
  }
  if (role === "test") {
    return "Test";
  }
  return "AI";
}
