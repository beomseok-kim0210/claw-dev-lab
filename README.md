# Claw Dev Multi-Agent Workspace

`Claw Dev`는 PM, Backend, Frontend, AI, Infra, Test 여섯 역할의 에이전트가 하나의 공유 채팅방에서 같은 맥락을 읽고 토론하며, 실제 코드까지 생성·검증·수정하는 멀티 에이전트 오케스트레이션 워크스페이스입니다.

이 프로젝트는 단순 채팅 UI가 아닙니다. 에이전트들이 토론으로 합의를 만들고, 필요한 경우에만 사용자에게 외부 입력을 요청하고, 명세 작성 → 구현 계획 → 코드 생성 → 역할 간 코드 리뷰 → 실제 워크스페이스 검증 → 수정·자가 수리 라운드까지 이어서 수행합니다.

기본 추론은 로컬 `Ollama` 모델로 동작하며, `GEMINI_API_KEY`를 설정하면 Gemini를 1차로 사용하고 쿼터가 소진되면 자동으로 Ollama로 폴백합니다.

## 핵심 특징

- 6개 역할 에이전트: `PM` · `Backend` · `Frontend` · `AI` · `Infra` · `Test`
- PM 시작 / PM 종료 구조의 자유 토론
- 사용자 질문 최소화 — 외부 서비스 연동에 필요한 정보(API 키, OAuth, 도메인 등)가 없을 때만 질문
- 역할별 명세 문서 + 구현 계획 + build brief 생성
- **공유 계약(shared contracts) 기반 인터페이스 정합** — 역할 간 API/함수/이벤트 계약을 먼저 고정해 인터페이스 데드락 방지
- 실제 타깃 폴더에 코드 파일 생성·수정 (2단계: 파일 플랜 → 파일 단위 생성)
- 역할 간 코드 리뷰 루프 + LLM 리뷰 → heuristic 폴백
- 실제 워크스페이스 검증 (`node --check`, `tsc --noEmit`, `node --test`)
- 검증 실패 시 **자율 수리 루프** — 실패 경로로 담당 역할을 추론해 자동 수정
- 프로젝트 메모리 기반 이어서 개발
- **멀티 프로바이더 LLM 스택** — Ollama 로컬 + Gemini(쿼터 소진 시 폴백)
- 웹 UI와 CLI 둘 다 지원
- (부가) Anthropic API 호환 프록시 + 멀티 프로바이더 런처

## 최근 변경 요약

### 1. 인터페이스 데드락 구조적 해결 (최신)

기존에는 각 역할이 자기 파일만 보고 코드를 생성해, 서로 다른 인터페이스를 만들어 연결이 깨지는 문제가 있었습니다. 이를 다음 구조로 해결했습니다.

- **build brief에 `sharedContracts` 필드 추가** — 역할 간 공유되는 계약을 먼저 명시
  - `kind`: `api-endpoint` | `shared-function` | `event`
  - `signature`(실제 경로/시그니처) · `owner`(생성 역할) · `consumers`(사용 역할) · `payload`(계약 상세)
- **역할 간 읽기 컨텍스트(cross-role files)** — 생성 시 다른 역할의 관련 파일을 read-only로 주입
  - Frontend는 `src/server/`, `src/api/`, `src/shared/`, `src/lib/` 참조
  - Backend는 `src/lib/`, `src/ai/` 참조 / AI는 `src/server/`, `src/shared/` 참조
  - Test는 모든 역할 파일 참조
- **역할별 경로 경계** — 각 역할이 소유·수정할 수 있는 경로를 고정

관련 파일:

- [src/types/generation.ts](./src/types/generation.ts)
- [src/agents/codegenPaths.ts](./src/agents/codegenPaths.ts)
- [src/prompts/buildBrief.ts](./src/prompts/buildBrief.ts)

### 2. 멀티 프로바이더 LLM 스택과 폴백

이제 추론은 Ollama 단일이 아니라 프로바이더 폴백 구조로 동작합니다.

- `GEMINI_API_KEY`가 있으면 **Gemini 1차 → Ollama 폴백** (`FallbackLLMClient`)
- 폴백 트리거: 쿼터/`rate limit`/`429`/`exceeded` 감지 또는 연속 3회 실패(`EXHAUSTION_THRESHOLD = 3`)
- 코드 생성 전용 모델 분리 가능 — `OLLAMA_CODEGEN_MODEL`로 코드 특화 모델 지정

관련 파일:

- [src/llm/llmClient.ts](./src/llm/llmClient.ts)
- [src/llm/geminiClient.ts](./src/llm/geminiClient.ts)
- [src/llm/ollamaClient.ts](./src/llm/ollamaClient.ts)

### 3. 자율 수리 루프

리뷰·수정 라운드 이후에도 최종 워크스페이스 검증이 실패하면, 사용자 개입 없이 자동으로 수리합니다.

- 최대 `MAX_AUTONOMOUS_REPAIR_CYCLES = 3` 사이클
- `inferRepairOwners()`가 실패한 체크의 경로/이름으로 담당 역할 추론
  - `public/ · app.js · index.html` → Frontend
  - `src/server · routes · health` → Backend
  - `src/lib · domain.ts` → AI
  - `tests/ · node --test` → Test
  - `docker · .env · ops/` → Infra
- 사이클마다 최대 12개 컨텍스트 파일을 읽어 재생성, 변경 파일이 없으면 stall로 종료

관련 파일:

- [src/orchestrator/multiAgentOrchestrator.ts](./src/orchestrator/multiAgentOrchestrator.ts)

### 4. 모델별 파라미터 중앙화

모든 구조화 LLM 호출 파라미터는 [src/llm/modelProfiles.ts](./src/llm/modelProfiles.ts)에서 (모델 계열 × 단계)로 관리합니다.

- 지원 계열: `qwen` · `qwen-coder` · `deepseek` · `llama` · `gemma` · `mistral` · `generic`
- 단계: `pm-initial` · `pm-final` · `clarification` · `discussion` · `spec` · `implementation-plan` · `build-brief` · `code-review` · `codegen`

현재 `qwen`(qwen3.5) 기준 대표값:

- `discussion`: `temperature 0.12`, `numPredict 1600`, `maxRetries 5`
- `spec`: `temperature 0.10`, `numPredict 2200`, `maxRetries 5`
- `build-brief`: `temperature 0.08`, `numPredict 2200`, `maxRetries 5`
- `code-review`: `temperature 0.08`, `numPredict 2000`, `maxRetries 5`
- `codegen`: `temperature 0.05`, `numPredict 4000`, `maxRetries 4` (파일 단위 생성으로 전환되며 파일당 토큰 확대)

### 5. 상태 기반 오케스트레이션 (이어서 개발)

- 타깃 워크스페이스를 읽어 기존 파일 목록 확인
- `.multi-agent/project-memory.json`에 최근 상태 저장 (이전 요청, 최신 build brief, unresolved finding, 파일 인덱스)
- 같은 타깃 폴더를 다시 지정하면 이어서 개발 모드로 진입
- 세션 생성 시 `startMode`(`new` | `continue`)로 신규/이어서 개발 선택

관련 파일:

- [src/orchestrator/projectMemory.ts](./src/orchestrator/projectMemory.ts)
- [src/agents/codegenPaths.ts](./src/agents/codegenPaths.ts)

### 6. 리뷰 기반 수정 라운드 + 워크스페이스 검증

코드 생성 후 흐름은 `draft → review → PM intervention → revise`이며, 리뷰는 `LLM review → fallback review` 순서로 동작합니다. 생성 직후 실제 검증을 수행하고 결과를 다음 라운드 입력으로 되돌립니다.

- `node --check` · `tsc --noEmit` · `node --test`
- 코드 생성은 placeholder/미완성 코드 거부, 상대 import 재작성 등 sanity 게이트 적용

관련 파일:

- [src/agents/codingAgent.ts](./src/agents/codingAgent.ts)
- [src/agents/codegenAgent.ts](./src/agents/codegenAgent.ts)
- [src/orchestrator/workspaceVerifier.ts](./src/orchestrator/workspaceVerifier.ts)

### 7. 사용자 질문 정책 축소

에이전트가 스스로 결정할 수 없는 외부 입력만 질문합니다.

- 허용 예: DART Open API 키, Google OAuth Client ID/Secret, 배포 도메인, 외부 연동 허용 여부
- 제거 대상 예: "API를 몇 개로 만들까요?", "어떤 화면을 넣을까요?", "어떤 DB 구조로 할까요?"

관련 파일:

- [src/agents/clarificationAgent.ts](./src/agents/clarificationAgent.ts)
- [src/prompts/clarification.ts](./src/prompts/clarification.ts)
- [src/types/contracts.ts](./src/types/contracts.ts)

## 전체 흐름

1. 사용자 요청 입력
2. PM 초기 메시지 (문제 정의 · MVP 범위)
3. 자유 토론 — `backend`, `frontend`, `ai`, `infra`, `test`가 동적으로 발언하고 이전 메시지 ID를 참조해 `support` / `refine` / `challenge` 반응
4. 외부 입력 필요 여부 판단 → 필요 시 사용자 clarification 요청
5. PM 최종 결정
6. 역할별 명세 문서 생성 (병렬)
7. 구현 계획 생성
8. build brief 생성 (sharedContracts 포함)
9. 실제 코드 생성 (2단계 · 역할 간 컨텍스트 주입)
10. 역할 간 코드 리뷰
11. 워크스페이스 검증
12. PM 개입 및 수정 라운드
13. 최종 검증 실패 시 자율 수리 루프
14. 산출물 저장 및 세션 종료

## 에이전트 역할

### PM
사용자 요청 해석 · MVP 범위 설정 · 토론 정리 · 최종 방향 결정 · 리뷰 병목 정리

### Backend
API 구조 제안 · 서버 엔트리포인트 및 데이터 계약 생성 · 백엔드 코드 구현

### Frontend
화면 구조와 사용자 흐름 제안 · 정적 자산과 클라이언트 로직 생성 · UX 리뷰

### AI
추천/요약/분석 흐름 설계 · 도메인 로직 제안 · AI 리스크 및 개선점 리뷰

### Infra
환경 변수·배포·운영 문서 · 도커 및 런타임 환경 정리 · 외부 연동 리스크 리뷰

### Test
테스트 전략 제안 · smoke/contract 테스트 파일 생성 · 실패 케이스와 blocking issue 식별

## 산출물

세션 완료 시 기본 생성 문서:

- `backend-spec.md` · `frontend-spec.md` · `ai-features.md` · `infra-spec.md` · `test-spec.md`
- `implementation-plan.md` · `build-brief.md`

세션 output 디렉터리에 저장되며 웹 UI에서 다운로드할 수 있습니다.

## 생성 코드

문서만 생성하는 시스템이 아니라, 지정한 타깃 폴더에 실제 코드 파일을 생성·수정합니다. 역할별 경로 경계 안에서만 파일을 소유합니다.

기본 생성 범위 예시:

- Backend: `package.json`, `tsconfig.json`, `src/server/`, `src/shared/contracts.ts`
- Frontend: `public/index.html`, `public/app.js`, `public/styles.css`
- AI: `src/lib/domain.ts`, `src/ai/`
- Infra: `.env.example`, `Dockerfile`, `ops/README.md`
- Test: `tests/bootstrap.test.mjs`, `tests/contracts.test.mjs`

실제 생성 중인 파일과 상태는 웹 UI에서 확인할 수 있습니다.

## 프로젝트 메모리와 이어서 개발

같은 타깃 폴더를 다시 지정하면 기존 프로젝트 상태를 읽고 이어서 개발합니다.

- 저장 위치: `<targetDirectory>/.multi-agent/project-memory.json`
- 저장 내용: 최근 요청 목록 · 마지막 build brief · 워크스페이스 파일 인덱스 · unresolved finding

웹 UI는 시작 전에 `/api/project-memory`를 호출해 새 프로젝트 여부, 기존 파일 수, 최근 요청, unresolved finding을 보여줍니다.

## 환경 변수

`.env.example`를 복사해 `.env`로 사용합니다.

멀티 에이전트 워크스페이스 (핵심):

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5
OLLAMA_CODEGEN_MODEL=          # (선택) 코드 생성 전용 모델
GEMINI_API_KEY=               # (선택) 설정 시 Gemini 1차, 쿼터 소진 시 Ollama 폴백
GEMINI_MODEL=gemini-2.5-flash
MULTI_AGENT_PORT=3030
AGENT_OUTPUT_DIR=             # (선택) 산출물 출력 폴더
```

Anthropic 호환 프록시 / 런처 (부가):

```text
ANTHROPIC_COMPAT_PROVIDER=openai   # openai | gemini | groq | ollama | copilot | zai
ANTHROPIC_COMPAT_PORT=8787
OPENAI_API_KEY=  / GROQ_API_KEY=  / COPILOT_TOKEN=  / ZAI_API_KEY=  / ANTHROPIC_API_KEY=
```

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

기본 주소: `http://127.0.0.1:11434`

### 3. 웹 UI 실행

```powershell
npm run web
```

접속 주소: `http://127.0.0.1:3030` / 헬스 체크: `GET /api/health`

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
npm run dev -- --output-dir .\artifacts --target-dir C:\path\to\multi-agent-workspace "모바일 금융 대시보드 앱을 만들어줘"
```

지원 플래그: `--cwd` · `--output-dir` · `--target-dir` · `--model` · `--base-url` · `--example`

## npm 스크립트

- `npm run dev` — CLI 실행 (tsx)
- `npm run web` — 웹 UI 서버 (기본 3030)
- `npm run web:all` — 멀티 서버 동시 기동 (`scripts/start-servers.ps1`)
- `npm run build` / `npm run check` — TypeScript 빌드 / 타입 체크
- `npm run claw-dev` — 멀티 프로바이더 런처 (`Leonxlnx-claude-code/claw-dev-launcher.js`)
- `npm run proxy:compat` / `npm run proxy:gemini` — Anthropic API 호환 프록시

## 웹 API

- `GET /api/health` — 현재 모델, codegen 모델, base URL, 기본 타깃 폴더
- `GET /api/project-memory?targetDirectory=...` — 이어서 개발 가능한 기존 상태 미리보기
- `GET /api/sessions` — 세션 목록 / `POST /api/sessions` — 새 세션 생성 (`startMode`: `new` | `continue`)
- `GET /api/sessions/:id` — 세션 스냅샷
- `GET /api/sessions/:id/events` — SSE 실시간 이벤트 스트림
- `POST /api/sessions/:id/clarifications` — clarification 답변 제출
- `GET /api/sessions/:id/artifacts/:filename` — 산출물 다운로드

세션 상태: `queued` → `running` → `waiting_input`(clarification 대기) → `completed` / `failed`

## Anthropic 호환 프록시 / 멀티 프로바이더 런처 (부가)

멀티 에이전트 워크스페이스와 별개로, 다양한 LLM 프로바이더를 Anthropic `/v1/messages` API 형태로 노출하는 호환 프록시와 런처를 포함합니다.

- `src/anthropicCompatProxy.ts` — OpenAI / Gemini / Groq / Ollama / Copilot / Z.AI를 Anthropic API 호환으로 변환 (tool use 포함)
- `Leonxlnx-claude-code/claw-dev-launcher.js` — 프로바이더·모델을 선택해 필요 시 프록시를 자식 프로세스로 기동하는 런처
- 실행: `npm run proxy:compat` (프로바이더는 `ANTHROPIC_COMPAT_PROVIDER`로 지정)

## 프로젝트 구조

```text
src/
  agents/         # 역할 에이전트, codegen·coding·clarification·test 등
  harness/        # 공유 프롬프트 하니스
  llm/            # llmClient(FallbackLLMClient) · ollamaClient · geminiClient · modelProfiles
  orchestrator/   # multiAgentOrchestrator · projectMemory · workspaceVerifier
  prompts/        # 역할/단계별 프롬프트
  server/         # sessionStore · previewManager
  types/          # contracts · generation (Zod 스키마)
  config.ts       # 환경설정 로딩
  server.ts       # 웹 서버 엔트리
  index.ts        # CLI 엔트리
  cli.tsx         # Ink 기반 CLI UI
  providers.ts    # Anthropic / Gemini 프로바이더 (런처용)
  tools.ts        # 툴 정의/핸들러
  anthropicCompatProxy.ts
public/           # 웹 UI 정적 자산
Leonxlnx-claude-code/   # 멀티 프로바이더 런처
scripts/          # start-servers.ps1
```

주요 파일:

- [src/orchestrator/multiAgentOrchestrator.ts](./src/orchestrator/multiAgentOrchestrator.ts)
- [src/orchestrator/projectMemory.ts](./src/orchestrator/projectMemory.ts)
- [src/orchestrator/workspaceVerifier.ts](./src/orchestrator/workspaceVerifier.ts)
- [src/agents/codingAgent.ts](./src/agents/codingAgent.ts)
- [src/agents/codegenAgent.ts](./src/agents/codegenAgent.ts)
- [src/agents/codegenPaths.ts](./src/agents/codegenPaths.ts)
- [src/llm/llmClient.ts](./src/llm/llmClient.ts)
- [src/llm/modelProfiles.ts](./src/llm/modelProfiles.ts)
- [src/types/generation.ts](./src/types/generation.ts)
- [src/server.ts](./src/server.ts)

## 기술 스택

- TypeScript · Node 22 · `tsx`
- LLM: Ollama(로컬) + Google Gemini(`@google/genai`, 폴백 구조) · Anthropic SDK(런처/프록시)
- 구조화 출력 검증: Zod v4 (스키마 검증 + 재시도 self-correction)
- CLI: `ink` + React 19 · 웹: 순수 Node `http` + SSE + vanilla JS

## 현재 한계

- 긴 end-to-end 실행은 로컬 모델 응답 시간에 영향을 받음
- 일부 보조 로직은 아직 heuristic fallback을 함께 사용
- 프로젝트 메모리는 파일 기반이며, 팀 단위 장기 지식 저장소는 아님
- 생성 코드 품질은 요청 복잡도와 모델 성능에 따라 편차가 있음

## 다음 개선 방향

- 프로젝트 히스토리 UI 분리
- 실패 테스트 기반 자동 수정 라운드 강화
- 더 큰 모델 또는 단계별 모델 혼합 운영
- 장기 프로젝트 메모리 구조 고도화
