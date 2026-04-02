import type { AgentRole, ChatMessage } from "../types/chat.js";
import type { AIFeaturesSpec, BackendSpec, FrontendSpec, ImplementationPlan } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

type CodingRole = Exclude<AgentRole, "pm">;

type BuildImplementationUpdatePromptArgs = {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  task: ImplementationPlan["tasks"][number];
  targetFiles: string[];
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
};

type BuildImplementationReviewPromptArgs = {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  targetMessage: ChatMessage;
  targetFiles: string[];
};

export function buildImplementationUpdatePrompt(args: BuildImplementationUpdatePromptArgs): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective: `${roleLabel(args.role)} 관점에서 실제 구현 작업을 시작하기 전, 어떤 파일을 만들고 무엇을 반영하는지 공유한다.`,
    responsibilities: roleResponsibilities(args.role),
    userRequest: args.userRequest,
    messages: args.messages,
    contextBlocks: [
      {
        title: "현재 담당 작업",
        lines: [
          `- taskId: ${args.task.id}`,
          `- title: ${args.task.title}`,
          `- goal: ${args.task.goal}`,
          ...args.task.deliverables.map((item) => `- deliverable: ${item}`),
        ],
      },
      {
        title: "예정 파일",
        lines: args.targetFiles.map((item) => `- ${item}`),
      },
      {
        title: "백엔드 명세 핵심",
        lines: [args.backendSpec.overview, ...args.backendSpec.implementationSteps.map((item) => `- ${item}`)],
      },
      {
        title: "프론트엔드 명세 핵심",
        lines: [args.frontendSpec.overview, ...args.frontendSpec.implementationSteps.map((item) => `- ${item}`)],
      },
      {
        title: "AI 명세 핵심",
        lines: [args.aiFeaturesSpec.overview, ...args.aiFeaturesSpec.implementationSteps.map((item) => `- ${item}`)],
      },
    ],
    contract: {
      schemaLines: [
        '  "headline": "구현 단계 제목",',
        `  "taskId": "${args.task.id}",`,
        '  "objective": "이번 구현의 목표 설명",',
        '  "targetFiles": ["path/one.ts", "path/two.ts"],',
        '  "worklog": ["무엇을 반영하는지 1", "무엇을 반영하는지 2"],',
        '  "validation": ["검증 포인트 1", "검증 포인트 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "targetFiles는 예정 파일 목록에서만 고른다.",
        "worklog는 실제 코드 구조와 연결되는 구현 설명이어야 한다.",
        "validation은 테스트나 확인 기준처럼 검증 가능한 문장으로 쓴다.",
      ],
    },
  });
}

export function buildImplementationReviewPrompt(args: BuildImplementationReviewPromptArgs): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective: `${roleLabel(args.role)} 관점에서 방금 공유된 구현 작업을 검토하고 보완 포인트를 남긴다.`,
    responsibilities: [
      "대상 메시지의 파일 범위를 읽고, 다른 역할 관점에서 위험이나 누락 가능성을 짚는다.",
      "근거 없는 칭찬보다 충돌 가능성, 연결 지점, 검증 항목을 우선한다.",
      "보완이 필요 없더라도 왜 현재 방향이 유효한지 명확히 설명한다.",
    ],
    userRequest: args.userRequest,
    messages: args.messages,
    contextBlocks: [
      {
        title: "검토 대상 메시지",
        lines: [
          `[${args.targetMessage.id}] ${args.targetMessage.speaker} (${args.targetMessage.role})`,
          args.targetMessage.content,
        ],
      },
      {
        title: "검토 대상 파일",
        lines: args.targetFiles.map((item) => `- ${item}`),
      },
    ],
    contract: {
      schemaLines: [
        '  "headline": "코드 리뷰 제목",',
        '  "reactionType": "refine",',
        `  "targetMessageId": "${args.targetMessage.id}",`,
        '  "targetFiles": ["path/one.ts"],',
        '  "assessment": "검토 의견",',
        '  "adjustment": "보완 제안",',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "reactionType은 challenge, support, refine 중 하나만 쓴다.",
        "assessment는 구현 단계에서 생길 실제 연결 문제를 중심으로 쓴다.",
        "adjustment는 바로 다음 수정이나 검증 행동으로 이어질 수 있어야 한다.",
      ],
    },
  });
}

function roleResponsibilities(role: CodingRole): string[] {
  if (role === "backend") {
    return [
      "서버, 저장소, 계약 타입처럼 시스템 골격을 우선 구현한다.",
      "프론트엔드와 AI 모듈이 연결할 API와 데이터 구조를 흔들리지 않게 잡는다.",
      "실행 가능한 최소 서버 흐름을 남긴다.",
    ];
  }

  if (role === "frontend") {
    return [
      "사용자 입력, 진행 상태, 결과 확인 흐름이 끊기지 않게 구성한다.",
      "백엔드 API 응답과 AI 결과를 사용자가 바로 읽을 수 있는 화면으로 풀어낸다.",
      "정적 자산과 상호작용 로직을 함께 정리한다.",
    ];
  }

  return [
    "요청 분석과 초안 생성 로직을 별도 모듈로 분리한다.",
    "백엔드가 호출할 수 있는 순수 함수 중심 구조를 만든다.",
    "불확실성과 검토 포인트를 결과에 포함시키는 가드레일을 반영한다.",
  ];
}

function roleLabel(role: CodingRole): string {
  if (role === "backend") {
    return "백엔드";
  }
  if (role === "frontend") {
    return "프론트엔드";
  }
  return "AI";
}
