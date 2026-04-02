# Claw Dev 멀티 에이전트 협업 시스템

`Claw Dev` 워크스페이스 위에 구축한 멀티 에이전트 협업 시스템입니다.  
사용자 요청을 받아 PM, 백엔드, 프론트엔드, AI, 인프라 에이전트가 하나의 공유 채팅방에서 토론하고, 필요하면 사용자에게 추가 질문을 보낸 뒤, 최종적으로 명세와 코드 산출물을 생성합니다.

## 개요

이 프로젝트는 단순 챗봇이 아니라 다음 흐름을 갖는 오케스트레이션 시스템입니다.

1. 사용자가 요청을 입력합니다.
2. PM 에이전트가 문제를 정의하고 초기 범위를 잡습니다.
3. 백엔드, 프론트엔드, AI, 인프라 에이전트가 자유 토론을 진행합니다.
4. 에이전트들은 이전 메시지 ID를 참조해 주장, 보완, 반박을 남깁니다.
5. 모호한 점이 있으면 사용자에게 추가 질문을 보냅니다.
6. PM 에이전트가 최종 MVP 방향을 결정합니다.
7. 명세 문서와 구현 계획을 생성합니다.
8. 코드 구현 단계에서 실제 파일을 생성하고, 웹 UI에는 파일 쓰기 진행 상황이 실시간으로 표시됩니다.

## 주요 기능

- 단일 LLM 사용
  - Ollama `qwen3`
- 역할 기반 멀티 에이전트 시뮬레이션
  - PM
  - Backend
  - Frontend
  - AI
  - Infra
- 웹 채팅방 UI
  - 실시간 대화 로그
  - 단계별 진행 상태
  - PM 최종 결정 표시
  - 추가 질문 입력
  - 산출물 다운로드
- 자유 토론형 플로우
  - PM이 시작
  - 중간 에이전트들은 동적으로 토론
  - PM이 마지막 결론 정리
- 구조화 산출물 생성
  - `backend-spec.md`
  - `frontend-spec.md`
  - `ai-features.md`
  - `implementation-plan.md`
- 코드 생성
  - 세션 출력 폴더 또는 지정한 타깃 폴더에 실제 파일 생성
- 실시간 코드 쓰기 현황
  - 어떤 역할이 어떤 파일을 쓰는 중인지 웹 UI에 표시
  - VS Code에서 같은 폴더를 열어두면 생성/수정 결과를 바로 확인 가능
- fallback 내장
  - LLM이 구조화 출력에 실패해도 문서 생성을 최대한 유지

## 현재 대화 흐름

현재 시스템의 기본 플로우는 아래와 같습니다.

1. 사용자 요청
2. PM 문제 정의
3. 자유 토론
4. 추가 확인
5. PM 최종 결정
6. 명세 산출물 생성
7. 구현 실행 계획 생성
8. 코드 구현

중간 토론에서는 각 에이전트가 특정 메시지를 참조하며 다음과 같은 형태로 응답할 수 있습니다.

- 핵심 주장
- 반박 대상 메시지
- 지지 의견
- 반박 의견
- 보완 제안

## 웹 UI에서 볼 수 있는 것

기본 주소:

```text
http://127.0.0.1:3030
```

웹 UI에서는 다음 항목을 확인할 수 있습니다.

- 세션 상태
- 단계별 진행 상황
- 실시간 채팅 메시지
- PM 최종 결정
- 추가 질문과 사용자 답변 입력
- 생성된 산출물 목록
- 코드 타깃 폴더
- 코드 쓰기 현황
  - 현재 작성 중인 역할
  - 현재 작성 중인 파일
  - 완료된 파일 목록

## 실행 방법

### 1. 의존성 설치

```powershell
npm install
```

### 2. Ollama 준비

```powershell
ollama pull qwen3
ollama serve
```

기본 Ollama 주소:

```text
http://127.0.0.1:11434
```

### 3. 웹 서버 실행

```powershell
npm run web
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:3030
```

### 4. CLI 실행

예시 실행:

```powershell
npm run dev -- --example
```

직접 요청:

```powershell
npm run dev -- "PRD를 업로드하면 멀티 에이전트가 토론하고 구현 계획과 코드를 만드는 워크스페이스를 설계해줘"
```

타깃 폴더를 지정해 실제 코드 파일을 바탕화면 등에 생성하려면:

```powershell
npm run dev -- --target-dir C:\Users\SSAFY\Desktop\multi-agent-workspace "실시간 코드 생성 테스트를 위한 대시보드를 만들어줘"
```

## 주요 명령어

```powershell
npm run check
npm run build
npm run web
npm run dev -- --example
npm run claw-dev
```

설명:

- `npm run check`
  - TypeScript 타입 검사
- `npm run build`
  - 프로젝트 빌드
- `npm run web`
  - 웹 UI 서버 실행
- `npm run dev`
  - CLI 기반 멀티 에이전트 실행
- `npm run claw-dev`
  - 기존 Claw Dev 런처 실행

## 산출물

### `backend-spec.md`

- API 설계
- 데이터 모델
- 기술 제약
- 구현 단계
- 예시 코드

### `frontend-spec.md`

- 화면 구조
- 컴포넌트 계층
- 사용성 포인트
- 구현 단계
- 예시 코드

### `ai-features.md`

- AI 기능 목록
- 구현 가능성
- 품질 및 안전성 메모
- 구현 단계
- 예시 코드

### `implementation-plan.md`

- 전체 구현 전략
- 역할별 작업 분해
- 파일/모듈 단위 작업 항목
- 완료 기준
- 다음 구현 단계 지시문

## 아키텍처

### 서버

- `src/server.ts`
  - HTTP 서버
  - 세션 생성 API
  - SSE 이벤트 스트림
  - 산출물 다운로드
- `src/server/sessionStore.ts`
  - 메모리 기반 세션 저장소
  - 메시지, 단계, 산출물, 추가 질문, 코드 활동 상태 관리

### 오케스트레이터

- `src/orchestrator/multiAgentOrchestrator.ts`
  - 전체 대화 흐름 제어
  - PM 시작, 자유 토론, 추가 질문, PM 결정, 문서 생성, 코드 생성 실행
- `src/orchestrator/chatState.ts`
  - 채팅 메시지 추적
- `src/orchestrator/outputWriter.ts`
  - 산출물 및 생성 코드 쓰기

### 에이전트

- `src/agents/pmAgent.ts`
- `src/agents/backendAgent.ts`
- `src/agents/frontendAgent.ts`
- `src/agents/aiAgent.ts`
- `src/agents/infraAgent.ts`
- `src/agents/reactionAgent.ts`
- `src/agents/clarificationAgent.ts`
- `src/agents/implementationPlanner.ts`
- `src/agents/codingAgent.ts`
- `src/agents/codeScaffolder.ts`

### 프롬프트

- `src/prompts/pm.ts`
- `src/prompts/backend.ts`
- `src/prompts/frontend.ts`
- `src/prompts/ai.ts`
- `src/prompts/infra.ts`
- `src/prompts/reaction.ts`
- `src/prompts/clarification.ts`
- `src/prompts/implementation.ts`
- `src/prompts/coding.ts`

### 하네스

- `src/harness/promptHarness.ts`

공통 프롬프트 규칙을 하네스로 묶어 역할별 출력을 일정한 구조로 유지합니다.

## 프로젝트 구조

```text
src/
  agents/
  harness/
  llm/
  orchestrator/
  prompts/
  server/
  types/
public/
Leonxlnx-claude-code/
```

## 환경 변수

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3
MULTI_AGENT_PORT=3030
AGENT_OUTPUT_DIR=.multi-agent-output
```

기본 코드 타깃 폴더는 아래 경로로 계산됩니다.

```text
C:\Users\<사용자이름>\Desktop\multi-agent-workspace
```

웹 UI에서 다른 경로를 직접 입력할 수도 있습니다.

## 상태와 한계

현재 가능한 것:

- 한국어 웹 UI
- 실시간 토론 로그
- 추가 질문 루프
- Infra 에이전트 포함 협업
- 명세 문서 생성
- 구현 계획 생성
- 실제 코드 파일 생성
- 코드 쓰기 현황 실시간 표시

아직 남아 있는 것:

- 기존 대규모 실제 프로젝트를 정교하게 분석한 뒤 부분 수정하는 고도화된 실행 모드
- 역할별 코드 생성 이후 자동 테스트 선택 및 결과 피드백 루프 고도화
- 더 세밀한 patch 단위 스트리밍

## 검증

기본 검증:

```powershell
npm run check
node --check public/app.js
```

헬스 체크:

```text
http://127.0.0.1:3030/api/health
```

예상 응답 예시:

```json
{
  "ok": true,
  "model": "qwen3",
  "baseUrl": "http://127.0.0.1:11434",
  "defaultTargetDirectory": "C:\\Users\\SSAFY\\Desktop\\multi-agent-workspace"
}
```
