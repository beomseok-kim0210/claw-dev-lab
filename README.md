# Claw Dev Multi-Agent Collaboration System

이 저장소는 두 가지를 함께 포함합니다.

- `Claw Dev` 런처 및 Anthropic 호환 프록시
- `qwen3` 기반 멀티 에이전트 협업 시스템

현재 핵심은 두 번째입니다.  
사용자 요청을 받으면 PM, 백엔드, 프론트엔드, AI 전문가가 하나의 공유 채팅방에서 토론하고, PM이 최종 MVP를 결정한 뒤 명세 문서와 구현 실행 계획을 생성합니다.

## 핵심 특징

- 단일 LLM만 사용
  - Ollama `qwen3`
- 멀티 에이전트는 별도 서비스가 아니라 역할 프롬프트로 시뮬레이션
- 웹 UI에서 실시간 채팅방 확인 가능
- PM 시작, 중간 자유 토론, PM 최종 결정 구조
- 중간 토론에서 주장, 반박 대상, 반박, 보완 제안이 모두 표시됨
- 토론 후 아래 산출물 생성
  - `backend-spec.md`
  - `frontend-spec.md`
  - `ai-features.md`
  - `implementation-plan.md`
- 구현 실행 계획은 LLM 출력이 흔들릴 경우 deterministic fallback으로 안정적으로 생성

## 현재 대화 흐름

지금 시스템은 고정 순서 1회 발언 구조가 아닙니다.

1. 사용자 요청 등록
2. PM이 문제 정의와 MVP 기준선 제시
3. 백엔드, 프론트엔드, AI가 동적 순서로 초기 주장 발언
4. 세 에이전트가 서로의 특정 메시지에 대해 지지, 반박, 보완 응답
5. PM이 전체 토론을 정리하고 최종 결정
6. 명세 문서 생성
7. 구현 실행 계획 생성

즉, 질서는 유지하지만 중간은 더 자연스러운 자유 토론처럼 동작합니다.

## 웹에서 볼 수 있는 것

브라우저 UI에서 바로 확인할 수 있습니다.

- 세션 상태
- 단계 진행 상황
- 실시간 채팅 메시지
- 각 메시지의 핵심 주장
- 어떤 메시지를 반박하는지
- 보완 제안 내용
- PM 최종 결정
- 생성된 markdown 산출물 다운로드

기본 주소:

```text
http://127.0.0.1:3030
```

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

그다음 브라우저에서:

```text
http://127.0.0.1:3030
```

### 4. CLI 예시 실행

```powershell
npm run dev -- --example
```

직접 요청을 넣고 싶으면:

```powershell
npm run dev -- "PRD를 업로드하면 멀티 에이전트가 토론하고 구현 계획까지 만드는 워크스페이스를 설계해줘"
```

## 자주 쓰는 명령어

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
  - 멀티 에이전트 웹 서버 실행
- `npm run dev`
  - CLI 기반 멀티 에이전트 실행
- `npm run claw-dev`
  - 기존 Claw Dev 런처 실행

## 산출물 설명

### `backend-spec.md`

- API 설계
- 데이터 모델
- 기술 제약
- 구현 단계
- 예시 코드

### `frontend-spec.md`

- 화면 구성
- 컴포넌트 구조
- 사용성 체크리스트
- 구현 단계
- 예시 코드

### `ai-features.md`

- AI 기능 목록
- 실현 가능성 메모
- 가드레일
- 구현 단계
- 예시 코드

### `implementation-plan.md`

- 전체 구현 전략
- 마일스톤
- 역할별 작업
- 각 작업의 산출물
- 완료 기준
- 구현 에이전트 시작 지시문

## 아키텍처

### 서버

- `src/server.ts`
  - HTTP 서버
  - 세션 생성 API
  - SSE 이벤트 스트림
  - 산출물 다운로드
- `src/server/sessionStore.ts`
  - 메모리 기반 세션 저장소

### 오케스트레이터

- `src/orchestrator/multiAgentOrchestrator.ts`
  - 전체 토론 흐름 제어
  - PM 시작 / 자유 토론 / PM 종료 / 산출물 생성
- `src/orchestrator/chatState.ts`
  - 채팅 메시지 누적
- `src/orchestrator/outputWriter.ts`
  - markdown 산출물 생성

### 에이전트

- `src/agents/pmAgent.ts`
- `src/agents/backendAgent.ts`
- `src/agents/frontendAgent.ts`
- `src/agents/aiAgent.ts`
- `src/agents/reactionAgent.ts`
- `src/agents/implementationPlanner.ts`

### 프롬프트

- `src/prompts/pm.ts`
- `src/prompts/backend.ts`
- `src/prompts/frontend.ts`
- `src/prompts/ai.ts`
- `src/prompts/reaction.ts`
- `src/prompts/implementation.ts`

### 하네스

- `src/harness/promptHarness.ts`

역할별 프롬프트를 공통 하네스로 묶습니다.

- `discussion`
  - 주장과 반박 중심 토론
- `artifact`
  - 역할별 명세 산출
- `implementation`
  - 실제 구현 실행 계획 생성

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

주요 값:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3
MULTI_AGENT_PORT=3030
AGENT_OUTPUT_DIR=.multi-agent-output
```

## 구현 상태

현재 완료:

- 한국어 웹 UI
- 실시간 채팅방
- PM 시작 / 자유 토론 / PM 마무리
- 주장/반박/보완 메시지 표시
- 역할별 명세 생성
- 구현 실행 계획 생성
- 하네스 프롬프팅 구조화

아직 남은 것:

- `implementation-plan.md`를 받아 실제 파일 수정까지 자동 수행하는 코드 실행 에이전트
- 웹 UI의 `구현 시작` 버튼
- 실제 코드베이스 연결 시 파일 단위 작업 분배

## 검증

기본 검증:

```powershell
npm run check
npm run dev -- --example
```

웹 서버 확인:

```text
http://127.0.0.1:3030/api/health
```

정상 응답 예:

```json
{"ok":true,"model":"qwen3","baseUrl":"http://127.0.0.1:11434"}
```

## 참고

이 저장소에는 기존 `Claw Dev` 런처도 그대로 포함되어 있습니다.  
다만 현재 README는 멀티 에이전트 협업 시스템 기준으로 정리되어 있습니다.
