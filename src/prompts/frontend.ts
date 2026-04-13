import type { ChatMessage } from "../types/chat.js";
import type { FrontendDiscussion, PMFinalDecision } from "../types/contracts.js";
import { buildHarnessPrompt } from "./shared.js";

export function buildFrontendDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "frontend",
    mode: "discussion",
    objective: "프론트엔드 관점에서 화면 구조, 비주얼 디자인, 사용자 흐름, 사용성 기준을 정리한다.",
    responsibilities: [
      "사용자 경험에 직접 영향을 주는 화면과 상호작용을 제안한다.",
      "대담한 미적 방향을 먼저 정한다: 브루탈리즘, 레트로퓨처리즘, 럭셔리/정제, 에디토리얼/매거진, 플레이풀, 아트데코, 인더스트리얼 등 맥락에 맞는 독창적 톤을 선택한다.",
      "구체적인 비주얼 디자인 방향을 제시한다: 개성 있는 폰트 페어링(Inter/Roboto/Arial 금지), 맥락에 맞는 컬러 팔레트(보라색 그라디언트 클리셰 금지), 비대칭/오버랩 레이아웃, CSS 애니메이션(staggered reveal, scroll-trigger).",
      "기존 발언에서 놓친 UX 리스크를 짚는다.",
      "모바일 퍼스트 반응형 설계를 기본으로 한다.",
      "로딩 상태, 에러 상태, 빈 상태(empty state) 등 엣지 케이스 UI를 명시한다.",
      "배경에 깊이감을 준다: 그래디언트 메시, 노이즈/그레인 텍스처, 기하학적 패턴, 반투명 레이어 등을 활용한다.",
      "사용자가 탭을 닫은 후에도 기억할 만한 '한 가지 인상적인 디테일'을 반드시 제안한다.",
      "토론 결과가 실제 UI 구현으로 바로 이어질 수 있을 만큼 구체적으로 쓴다.",
    ],
    userRequest,
    messages,
    contract: {
      schemaLines: [
        '  "headline": "프론트엔드 관점 제목",',
        '  "summary": "프론트엔드 관점 요약",',
        '  "claim": "핵심 주장 한 문장",',
        '  "support": ["근거 1", "근거 2"],',
        '  "rebuttalTarget": "msg-002",',
        '  "rebuttal": "반박 또는 보완 설명",',
        '  "screens": ["화면 1", "화면 2", "화면 3"],',
        '  "components": ["컴포넌트 1", "컴포넌트 2", "컴포넌트 3"],',
        '  "usabilityNotes": ["사용성 메모 1", "사용성 메모 2"],',
        '  "references": ["msg-001", "msg-002"]',
      ],
      constraints: [
        "support는 2개 이상 5개 이하로 작성한다.",
        "screens와 components는 3개 이상 6개 이하로 작성한다.",
        "usabilityNotes는 2개 이상 5개 이하로 작성한다.",
        "반박 대상이 없으면 rebuttalTarget에 '없음'을 넣는다.",
      ],
    },
  });
}

export function buildFrontendSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: "frontend",
    mode: "artifact",
    objective: "PM 최종 결정을 기준으로 구현 가능한 프론트엔드 명세를 완성한다. 디자인 품질이 전문적이어야 한다.",
    responsibilities: [
      "핵심 화면과 컴포넌트 구조를 실제 개발 순서에 맞게 정리한다.",
      "디자인 시스템을 명세에 포함한다: 개성 있는 폰트 페어링(Google Fonts/CDN 명시), 맥락 맞춤 컬러 팔레트(CSS 변수), 간격 체계(CSS custom properties).",
      "선택한 미적 방향(브루탈리즘, 럭셔리, 에디토리얼 등)에 맞는 구체적 CSS 전략을 명세에 포함한다: 레이아웃 구성, 애니메이션(@keyframes, staggered reveals), 배경 텍스처(gradient mesh, noise, geometric patterns).",
      "사용성 체크리스트를 바로 검증할 수 있는 수준으로 적는다.",
      "로딩/에러/빈 상태의 UI 처리를 명세에 포함한다.",
      "예시 코드가 화면 구조와 데이터 흐름을 보여주도록 쓴다.",
    ],
    userRequest: args.userRequest,
    contextBlocks: [
      { title: "PM 최종 결정", lines: [args.finalDecision.finalDecision] },
      { title: "MVP 범위", lines: args.finalDecision.mvpScope.map((item) => `- ${item}`) },
      { title: "프론트엔드 요약", lines: [args.frontendDiscussion.summary] },
      { title: "핵심 주장", lines: [`- ${args.frontendDiscussion.claim}`] },
      { title: "화면 구성", lines: args.frontendDiscussion.screens.map((item) => `- ${item}`) },
      { title: "컴포넌트 구성", lines: args.frontendDiscussion.components.map((item) => `- ${item}`) },
      { title: "사용성 메모", lines: args.frontendDiscussion.usabilityNotes.map((item) => `- ${item}`) },
    ],
    contract: {
      schemaLines: [
        '  "overview": "프론트엔드 개요",',
        '  "screens": ["화면 1", "화면 2", "화면 3"],',
        '  "components": ["컴포넌트 1", "컴포넌트 2", "컴포넌트 3"],',
        '  "usabilityChecklist": ["체크 1", "체크 2"],',
        '  "implementationSteps": ["단계 1", "단계 2", "단계 3"],',
        '  "exampleCode": {',
        '    "language": "tsx",',
        '    "snippet": "예시 코드"',
        "  }",
      ],
      constraints: [
        "screens, components, implementationSteps는 모두 3개 이상 작성한다.",
        "exampleCode는 실제 화면 구조와 연결되어야 한다.",
        "MVP 범위를 넘어서는 기능은 넣지 않는다.",
      ],
    },
  });
}
