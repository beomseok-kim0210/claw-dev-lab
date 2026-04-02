import type { ChatMessage } from "../types/chat.js";
import type { InfraDiscussion, PMFinalDecision } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildInfraDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "infra",
    mode: "discussion",
    objective: "배포, 환경 분리, 운영 안정성 관점에서 핵심 주장을 정리한다.",
    responsibilities: [
      "운영 환경에서 바로 문제가 될 요소를 먼저 지적한다.",
      "런타임, 배포 토폴로지, 관측 가능성의 최소 기준을 정한다.",
      "개발 편의보다 배포 가능성과 유지보수성을 우선한다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "인프라 관점 제목",',
        '  "summary": "인프라 관점 요약",',
        '  "claim": "핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-002",',
        '  "rebuttal": "반박 또는 보완 설명",',
        '  "deploymentTopology": ["토폴로지 1", "토폴로지 2", "토폴로지 3"],',
        '  "environments": ["환경 1", "환경 2"],',
        '  "observability": ["관측 항목 1", "관측 항목 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하로 작성한다.",
        "deploymentTopology는 3개 이상 6개 이하로 작성한다.",
        "environments와 observability는 각각 2개 이상 5개 이하로 작성한다.",
        "반박 대상이 없으면 rebuttalTarget에 '없음'을 넣는다.",
      ],
    },
  });
}

export function buildInfraSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  infraDiscussion: InfraDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "infra",
    mode: "artifact",
    objective: "PM 최종 결정을 기준으로 운영 가능한 인프라 명세를 완성한다.",
    responsibilities: [
      "배포 토폴로지와 환경 구성을 실제 실행 순서로 정리한다.",
      "운영 체크리스트를 누락 없이 적는다.",
      "예시 코드가 배포 설정과 연결되도록 쓴다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "인프라 요약", lines: [args.infraDiscussion.summary] },
      { title: "핵심 주장", lines: [`- ${args.infraDiscussion.claim}`] },
      { title: "배포 토폴로지", lines: args.infraDiscussion.deploymentTopology.map((item) => `- ${item}`) },
      { title: "환경 분리", lines: args.infraDiscussion.environments.map((item) => `- ${item}`) },
      { title: "관측 항목", lines: args.infraDiscussion.observability.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "인프라 개요",',
        '  "deploymentTopology": ["토폴로지 1", "토폴로지 2", "토폴로지 3"],',
        '  "environments": ["환경 1", "환경 2", "환경 3"],',
        '  "operationsChecklist": ["체크 1", "체크 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "yaml",',
        '    "snippet": "예시 코드"',
        "  }",
      ],
      constraints: [
        "deploymentTopology, environments, implementationSteps는 3개 이상 작성한다.",
        "operationsChecklist는 2개 이상 작성한다.",
        "예시 코드는 Docker Compose, 컨테이너, 스크립트 중 하나와 연결되어야 한다.",
      ],
    },
  });
}
