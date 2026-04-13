# CLAUDE.md

## 1. Project Identity

- **Project name:** Claw Dev Multi-Agent Workspace
- **Product type:** 로컬 LLM 기반 멀티 에이전트 오케스트레이션 시스템
- **Version:** 0.1.0
- **Main goal:**
  - 사용자가 제품 아이디어를 입력하면, PM/Backend/Frontend/AI/Infra/Test 에이전트가 토론하고, 실제 코드까지 생성/검증/수정하는 자동화 개발 파이프라인
- **Primary users:**
  - 아이디어를 빠르게 프로토타입하고 싶은 개발자
  - 멀티 에이전트 시스템을 실험하고 싶은 엔지니어
- **Non-goals:**
  - 프로덕션 배포 자동화 (CI/CD 실행 등)
  - 외부 클라우드 서비스 연동 자동화
  - 사용자 인증/결제 시스템

---

## 2. Operating Contract

You are not a chatbot for random output.
You are an implementation agent working inside a controlled software project.

Always optimize for:
1. correctness
2. small safe diffs
3. explicit planning before edits
4. verifiable outputs
5. maintainable code over clever code

Never optimize for:
- flashy rewrites
- large speculative refactors
- hidden assumptions
- bypassing validation
- editing sensitive files without approval

---

## 3. Plan Before Edit

Before changing code, always do the following:
1. identify task type
   - bugfix / feature / refactor / docs / review / test
2. summarize:
   - target files
   - non-target files
   - likely root cause
   - risk level
3. wait for approval if:
   - more than 3 files will change
   - architecture changes are involved
   - any destructive action is required

Do not implement first and explain later.

---

## 4. Codebase Boundaries

### Allowed common areas
- `src/agents/` - 역할별 에이전트 함수
- `src/prompts/` - 역할별 프롬프트
- `src/orchestrator/` - 오케스트레이션 로직
- `src/types/` - 타입 정의
- `src/llm/` - LLM 클라이언트 및 모델 프로파일
- `src/harness/` - 프롬프트 하네스
- `src/server/` - 웹 서버 보조 (세션, 프리뷰)
- `public/` - 웹 UI (HTML/JS/CSS)
- `scripts/` - 유틸리티 스크립트

### Sensitive areas (수정 전 승인 필요)
- `.env` / `.env.example` - API 키, 모델 설정
- `src/config.ts` - 전역 설정 구조
- `src/server.ts` - 웹 서버 진입점 및 라우팅
- `src/index.ts` - CLI 진입점
- `src/anthropicCompatProxy.ts` - 프록시 서버
- `Leonxlnx-claude-code/` - 벤더 런처 코드 (직접 수정 금지)
- `package.json` - 의존성 변경 시 확인 필요

### Rules
- never edit `.env`
- never modify `Leonxlnx-claude-code/` directory
- ask before deleting files
- ask before changing server routes, config schema, or type contracts
- never silently rename exported functions used by other modules

---

## 5. Architecture Rules

### Core Patterns
- **오케스트레이터**: `MultiAgentOrchestrator` 단일 클래스가 전체 파이프라인 제어
- **에이전트**: `src/agents/`에 역할당 1파일, 함수 단위 분리 (클래스 아님)
- **프롬프트**: `src/prompts/`에서 관리, `buildHarnessPrompt()`를 통해 생성
- **LLM 응답 검증**: 모든 구조화 출력은 Zod 스키마로 파싱 + 재시도 루프
- **모듈 시스템**: ESM (`"type": "module"`), 모든 상대 import는 `.js` 확장자 필수
- **메모리**: 프로젝트 메모리는 `<targetDir>/.multi-agent/project-memory.json`에 파일 기반 저장

### 6 Agent Roles
| Role | File | Responsibility |
|------|------|----------------|
| PM | `pmAgent.ts` | 문제 정의, 최종 결정, 리뷰 라운드 조율 |
| Backend | `backendAgent.ts` | 서버, API, DB 설계 및 구현 |
| Frontend | `frontendAgent.ts` | UI/UX, 컴포넌트, 화면 구현 |
| AI | `aiAgent.ts` | AI 기능, 모델 연동, 프롬프트 |
| Infra | `infraAgent.ts` | 배포, CI/CD, 환경 설정 |
| Test | `testAgent.ts` | 테스트 전략, 테스트 파일 생성 |

### Pipeline Phases (순서)
1. PM 초기 문제 정의 (`pm-initial`)
2. 자유 토론 + 반응 라운드 (`discussion`)
3. Clarification - 외부 입력만 질문 (`clarification`)
4. PM 최종 결정 (`pm-final`)
5. 역할별 명세 생성 (`execution`)
6. 구현 계획 + Build Brief (`implementation`)
7. 코드 생성 + 리뷰 + 검증 + 수정 (`coding`)

### Code Style
- prefer existing project patterns over introducing new abstractions
- avoid duplicate business logic
- keep agent functions pure: input -> LLM call -> validated output
- keep fallback functions deterministic (no LLM call)
- document non-obvious design decisions in commit messages

---

## 6. Verification Contract

All work must be validated before completion.

### Required checks
```bash
npm run check          # tsc --noEmit (TypeScript type check)
npm run build          # tsc -p tsconfig.json (full compile)
```

### Generated code verification (workspaceVerifier)
- `node --check` - JS 문법 검사
- `tsc --noEmit` - TypeScript 타입 검사 (node_modules 없으면 --skipLibCheck)
- `node --test` - Node 테스트 실행 (.test.mjs 파일)

### If verification cannot be run
- explicitly say what could not be verified
- explain why
- do not claim success

---

## 7. Tech Stack

| Category | Technology |
|----------|-----------|
| Language | TypeScript 5.9, strict mode |
| Runtime | Node.js >= 22 |
| Module | ESM (NodeNext) |
| LLM | Ollama (qwen3 default), Anthropic SDK, Google GenAI |
| CLI UI | Ink (React for terminal) |
| Web UI | Vanilla HTML/JS/CSS |
| Validation | Zod 4 |
| Dev runner | tsx |
| Build | tsc |

---

## 8. Default Commands

| Purpose | Command |
|---------|---------|
| Dev (CLI) | `npm run dev` |
| Dev (Web) | `npm run web` |
| Type check | `npm run check` |
| Build | `npm run build` |
| Start (compiled CLI) | `npm start` |
| Start (compiled Web) | `npm run web:start` |
| Proxy | `npm run proxy:compat` |

No linter or formatter is currently configured.
No dedicated test runner is configured (workspace verifier handles generated code tests).

---

## 9. Key File Reference

| File | Purpose |
|------|---------|
| `src/orchestrator/multiAgentOrchestrator.ts` | 전체 파이프라인 제어 (가장 큰 파일) |
| `src/orchestrator/workspaceVerifier.ts` | 생성 코드 검증 (node --check, tsc, node --test) |
| `src/orchestrator/projectMemory.ts` | 프로젝트 메모리 로드/저장 |
| `src/agents/codegenAgent.ts` | 역할별 코드 번들 생성 |
| `src/agents/codeScaffolder.ts` | 코드 스캐폴딩 fallback |
| `src/agents/codingAgent.ts` | 구현 업데이트, LLM 코드 리뷰 |
| `src/harness/promptHarness.ts` | 공통 프롬프트 빌더 |
| `src/llm/modelProfiles.ts` | 모델별/단계별 파라미터 프로파일 |
| `src/llm/ollamaClient.ts` | Ollama API 클라이언트 |
| `src/config.ts` | 환경변수 기반 설정 로더 |
| `src/server.ts` | 웹 서버 (SSE, REST API) |
| `src/types/contracts.ts` | 에이전트 출력 Zod 스키마 전체 |

---

## 10. Review Rules

After implementation:
- review for correctness
- review for regression risk
- review for unnecessary complexity
- review for missing validation (Zod schema)
- review for broken import paths (.js extension)
- review for edge cases in LLM response parsing

If major concerns remain, say so explicitly.

---

## 11. Output Style

When responding:
- be concise
- use direct technical language
- do not overstate confidence
- separate facts from assumptions
- show exact changed files when possible
- summarize in implementation-ready terms

---

## 12. Escalation Triggers

Stop and ask before proceeding if:
- requirements conflict
- data loss is possible
- security/privacy impact exists
- more than one architecture direction is plausible
- requested change conflicts with existing rules
- changes touch `multiAgentOrchestrator.ts` core flow
- changes affect Zod schemas in `src/types/contracts.ts`
- changes affect the verification pipeline

---

## 13. Success Definition

A task is complete only if:
- scope is respected
- code is updated safely
- `npm run check` passes
- remaining uncertainty is reported
- changed files are listed in response
