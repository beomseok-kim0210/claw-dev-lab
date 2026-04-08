# Claw Dev Multi-Agent Workspace

`Claw Dev`는 로컬 Ollama 모델 하나로 여러 역할의 에이전트를 시뮬레이션해, 사용자와 함께 기획하고 실제 코드까지 생성·수정하는 멀티 에이전트 오케스트레이션 워크스페이스입니다.

이 프로젝트는 단순 채팅 UI가 아닙니다. PM, Backend, Frontend, AI, Infra, Test 에이전트가 하나의 공유 채팅방에서 같은 맥락을 읽고 토론하며, 필요한 경우에만 사용자에게 외부 입력을 요청하고, 이후 명세 작성, 코드 생성, 코드 리뷰, 검증, 수정 라운드까지 이어서 수행합니다.

## 핵심 특징

- 6개 역할 에이전트
  - `PM`
  - `Backend`
  - `Frontend`
  - `AI`
  - `Infra`
  - `Test`
- PM 시작 / PM 종료 구조의 자유 토론
- 사용자 질문 최소화
  - 외부 서비스 연동에 필요한 정보가 없을 때만 질문
  - 예: DART API 키, Google OAuth, 리디렉션 도메인, 서비스 계정, 실제 연동 대상, 승인 필요 여부
- 역할별 명세 문서 생성
- 구현 계획과 build brief 생성
- 실제 타깃 폴더에 코드 파일 생성 및 수정
- 역할 간 코드 리뷰 루프
- LLM 리뷰 + 실행 검증 결과 기반 수정 라운드
- 프로젝트 메모리 기반 이어서 개발
- 웹 UI와 CLI 둘 다 지원

## 최근 변경 요약

### 1. 테스트 에이전트 추가

이제 테스트 역할이 전체 파이프라인에 참여합니다.

- 토론 단계에서 테스트 관점의 리스크를 제안
- `test-spec.md` 생성
- 테스트 파일 생성
- 코드 리뷰 단계에서 품질 게이트 역할 수행
- 타입체크/테스트 실패 시 재수정 요청 생성

기본 생성 대상 예시:

- `tests/bootstrap.test.mjs`
- `tests/contracts.test.mjs`

### 2. 모델별 파라미터 중앙화

모든 구조화 LLM 호출 파라미터는 이제 [src/llm/modelProfiles.ts](./src/llm/modelProfiles.ts)에서 관리합니다.

- 지원 모델 계열
  - `qwen3.5`
  - `qwen-coder`
  - `deepseek`
  - `llama`
  - `gemma`
  - `mistral`
- 단계별 프로파일 분리
  - `pm-initial`
  - `pm-final`
  - `clarification`
  - `discussion`
  - `spec`
  - `implementation-plan`
  - `build-brief`
  - `code-review`
  - `codegen`

현재 `qwen3.5` 기준 대표값:

- `discussion`: `temperature 0.12`, `numPredict 640`, `maxRetries 5`
- `spec`: `temperature 0.10`, `numPredict 920`, `maxRetries 5`
- `build-brief`: `temperature 0.08`, `numPredict 920`, `maxRetries 5`
- `code-review`: `temperature 0.08`, `numPredict 960`, `maxRetries 5`
- `codegen`: `temperature 0.05`, `numPredict 1700`, `maxRetries 4`

### 3. 상태 기반 오케스트레이션

이제 오케스트레이터는 항상 새 프로젝트처럼 행동하지 않습니다.

- 타깃 워크스페이스를 읽어 기존 파일 목록 확인
- `.multi-agent/project-memory.json`에 최근 상태 저장
- 이전 요청, 최신 build brief, unresolved finding, 파일 인덱스 보관
- 같은 타깃 폴더를 다시 지정하면 이어서 개발 모드로 진입

관련 파일:

- [src/orchestrator/projectMemory.ts](./src/orchestrator/projectMemory.ts)
- [src/agents/codegenPaths.ts](./src/agents/codegenPaths.ts)

### 4. 리뷰 기반 수정 라운드 강화

이제 코드 생성 후 흐름은 다음과 같습니다.

1. 담당 역할이 코드 번들 생성
2. 다른 역할들이 실제 생성 파일을 읽고 리뷰
3. 리뷰 결과와 검증 실패를 종합
4. PM이 병목과 우선순위를 요약해 개입
5. 같은 역할이 수정 라운드 수행
6. 최대 라운드 제한 안에서 반복

즉, 예전의 "한 번 만들고 끝"이 아니라 `draft -> review -> PM intervention -> revise` 구조입니다.

관련 파일:

- [src/agents/codingAgent.ts](./src/agents/codingAgent.ts)
- [src/orchestrator/multiAgentOrchestrator.ts](./src/orchestrator/multiAgentOrchestrator.ts)
- [src/prompts/coding.ts](./src/prompts/coding.ts)

### 5. LLM 코드 리뷰 + 워크스페이스 검증

코드 리뷰는 이제 heuristic만 쓰지 않고 `LLM review -> fallback review` 순서로 동작합니다.

또한 생성 직후 실제 워크스페이스 검증을 수행합니다.

- `node --check`
- `tsc --noEmit`
- `node --test`

검증 결과는 채팅 메시지와 다음 수정 라운드 입력에 다시 들어갑니다.

관련 파일:

- [src/orchestrator/workspaceVerifier.ts](./src/orchestrator/workspaceVerifier.ts)
- [src/agents/codingAgent.ts](./src/agents/codingAgent.ts)

### 6. 사용자 질문 정책 축소

사용자 질문은 더 이상 설계 자체를 대신 묻지 않습니다.

지금은 에이전트들이 스스로 결정할 수 없는 외부 입력만 질문합니다.

허용 질문 예시:

- DART Open API 키를 제공할 수 있나요?
- Google OAuth Client ID / Secret을 사용하나요?
- 배포 도메인은 무엇인가요?
- 외부 연동을 허용하나요?

제거 대상 예시:

- API를 몇 개로 만들까요?
- 어떤 화면을 넣을까요?
- 어떤 DB 구조로 할까요?

관련 파일:

- [src/agents/clarificationAgent.ts](./src/agents/clarificationAgent.ts)
- [src/prompts/clarification.ts](./src/prompts/clarification.ts)
- [src/types/contracts.ts](./src/types/contracts.ts)

### 7. UI 정리

웹 UI도 최근 변경에 맞춰 정리했습니다.

- 긴 설명 카드 축소
- 질문 패널 단순화
- 프로젝트 이어서 개발 여부 표시
- 코드 쓰기 현황 표시
- 단계 상태 간소화

관련 파일:

- [public/index.html](./public/index.html)
- [public/app.js](./public/app.js)
- [public/styles.css](./public/styles.css)

## 전체 흐름

현재 오케스트레이션 흐름은 아래와 같습니다.

1. 사용자 요청 입력
2. PM 초기 메시지
3. 자유 토론
   - `backend`, `frontend`, `ai`, `infra`, `test`가 동적으로 발언
   - 이전 메시지 ID를 참조해 `support`, `refine`, `challenge` 반응
4. 외부 입력 필요 여부 판단
5. 필요 시 사용자 clarification 요청
6. PM 최종 결정
7. 역할별 명세 문서 생성
8. 구현 계획 생성
9. build brief 생성
10. 실제 코드 생성
11. 역할 간 코드 리뷰
12. 워크스페이스 검증
13. PM 개입 및 수정 라운드
14. 산출물 저장 및 세션 종료

## 에이전트 역할

### PM

- 사용자 요청 해석
- MVP 범위 설정
- 토론 정리
- 최종 방향 결정
- 리뷰 라운드 병목 정리

### Backend

- API 구조 제안
- 서버 엔트리포인트 및 데이터 계약 생성
- 백엔드 코드 구현

### Frontend

- 화면 구조와 사용자 흐름 제안
- 정적 자산과 클라이언트 로직 생성
- 프론트 코드 구현 및 UX 관점 리뷰

### AI

- 추천/요약/분석 흐름 설계
- 도메인 로직과 AI 보조 기능 제안
- AI 관련 리스크 및 개선점 리뷰

### Infra

- 환경 변수, 배포, 운영 문서
- 도커 및 런타임 환경 정리
- 외부 연동과 실행 환경 리스크 리뷰

### Test

- 테스트 전략 제안
- smoke/contract 테스트 파일 생성
- 실패 케이스와 blocking issue 식별

## 산출물

세션 완료 시 기본적으로 다음 문서가 생성됩니다.

- `backend-spec.md`
- `frontend-spec.md`
- `ai-features.md`
- `infra-spec.md`
- `test-spec.md`
- `implementation-plan.md`
- `build-brief.md`

이 문서는 세션 output 디렉터리에 저장되며, 웹 UI에서 다운로드할 수 있습니다.

## 생성 코드

문서만 생성하는 시스템이 아니라, 지정한 타깃 폴더에 실제 코드 파일을 생성하거나 수정합니다.

기본적인 생성 범위 예시:

- Backend
  - `package.json`
  - `tsconfig.json`
  - `src/server.ts`
  - `src/shared/contracts.ts`
- Frontend
  - `public/index.html`
  - `public/app.js`
  - `public/styles.css`
- AI
  - `src/lib/domain.ts`
- Infra
  - `.env.example`
  - `Dockerfile`
  - `ops/README.md`
- Test
  - `tests/bootstrap.test.mjs`
  - `tests/contracts.test.mjs`

실제 생성 중인 파일과 상태는 웹 UI에서 확인할 수 있습니다.

## 프로젝트 메모리와 이어서 개발

같은 타깃 폴더를 다시 지정하면, 시스템은 기존 프로젝트 상태를 읽고 이어서 개발합니다.

저장 위치:

- `<targetDirectory>/.multi-agent/project-memory.json`

저장 내용:

- 최근 요청 목록
- 마지막 build brief
- 워크스페이스 파일 인덱스
- unresolved finding

웹 UI는 시작 전에 `/api/project-memory`를 호출해 다음 정보를 보여줍니다.

- 새 프로젝트인지 여부
- 기존 파일 수
- 최근 요청
- unresolved finding

## 실행 방법

### 1. 의존성 설치

```powershell
npm install
```

### 2. Ollama 준비

```powershell
ollama pull qwen3.5
ollama serve
```

기본 주소:

```text
http://127.0.0.1:11434
```

### 3. 웹 UI 실행

```powershell
npm run web
```

접속 주소:

```text
http://127.0.0.1:3030
```

헬스 체크:

```text
GET /api/health
```

### 4. CLI 실행

```powershell
npm run dev -- "공시자료와 뉴스 기반 커리어 인사이트 앱을 만들어줘"
```

예시 실행:

```powershell
npm run dev -- --example
```

타깃 폴더 지정:

```powershell
npm run dev -- --output-dir .\artifacts --target-dir C:\Users\SSAFY\Desktop\multi-agent-workspace "모바일 금융 대시보드 앱을 만들어줘"
```

지원 플래그:

- `--cwd`
- `--output-dir`
- `--target-dir`
- `--model`
- `--base-url`
- `--example`

## 웹 API

주요 엔드포인트:

- `GET /api/health`
  - 현재 모델, base URL, 기본 타깃 폴더 확인
- `GET /api/project-memory?targetDirectory=...`
  - 이어서 개발 가능한 기존 프로젝트 상태 미리보기
- `POST /api/sessions`
  - 새 세션 생성
- `GET /api/sessions/:id`
  - 세션 스냅샷 조회
- `GET /api/sessions/:id/events`
  - SSE 실시간 이벤트 스트림
- `POST /api/sessions/:id/clarifications`
  - clarification 답변 제출
- `GET /api/sessions/:id/artifacts/:filename`
  - 산출물 다운로드

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
```

주요 파일:

- [src/orchestrator/multiAgentOrchestrator.ts](./src/orchestrator/multiAgentOrchestrator.ts)
- [src/orchestrator/projectMemory.ts](./src/orchestrator/projectMemory.ts)
- [src/orchestrator/workspaceVerifier.ts](./src/orchestrator/workspaceVerifier.ts)
- [src/agents/codingAgent.ts](./src/agents/codingAgent.ts)
- [src/agents/testAgent.ts](./src/agents/testAgent.ts)
- [src/agents/clarificationAgent.ts](./src/agents/clarificationAgent.ts)
- [src/llm/modelProfiles.ts](./src/llm/modelProfiles.ts)
- [src/server.ts](./src/server.ts)

## 현재 한계

아직 완전히 해결되지 않은 점도 있습니다.

- 긴 end-to-end 실행은 `qwen3.5` 응답 시간에 영향을 받음
- 일부 보조 로직은 아직 heuristic fallback을 함께 사용
- 프로젝트 메모리는 현재 파일 기반이며, 팀 단위 장기 지식 저장소는 아님
- 생성 코드 품질은 요청 복잡도와 모델 성능에 따라 편차가 있음

## 다음 개선 방향

- 프로젝트 히스토리 UI 분리
- 실패 테스트 기반 자동 수정 라운드 강화
- 더 큰 모델 또는 단계별 모델 혼합 운영
- 장기 프로젝트 메모리 구조 고도화
