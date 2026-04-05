# Claw Dev Multi-Agent Workspace

`Claw Dev` 워크스페이스 안에서 동작하는 멀티 에이전트 협업 시스템입니다.
사용자 요청을 받으면 PM, Backend, Frontend, AI, Infra, Test 에이전트가 하나의 공유 채팅방에서 토론하고,
필요하면 사용자에게 추가 질문을 보낸 뒤, 명세 문서와 구현 계획을 만들고, 실제 코드 파일까지 생성합니다.

이 저장소의 핵심은 단순 챗봇이 아니라 다음 구조를 가진 오케스트레이션 엔진입니다.

- 역할별 에이전트가 이전 메시지를 읽고 반응한다.
- PM이 시작과 종료를 담당한다.
- 구현 단계에서도 코드 생성과 코드 리뷰가 이어진다.
- 테스트 에이전트가 품질 게이트를 잡는다.
- 모델별 LLM 파라미터를 중앙 프로파일로 관리한다.

## 현재 상태

지금 구현된 범위는 다음과 같습니다.

- 웹 UI 기반 멀티 에이전트 채팅방
- CLI 기반 실행 경로
- 동적 토론 순서
  - PM이 먼저 시작
  - 중간은 `backend / frontend / ai / infra / test`가 순서를 바꿔가며 토론
  - 마지막은 PM이 최종 결정
- 추가 질문 루프
  - 모호한 점이 있으면 사용자에게 질문
  - 답변을 받으면 같은 세션을 이어서 재개
- 역할별 명세 생성
  - `backend-spec.md`
  - `frontend-spec.md`
  - `ai-features.md`
  - `infra-spec.md`
  - `test-spec.md`
  - `implementation-plan.md`
  - `build-brief.md`
- 실제 코드 생성
  - 지정한 타깃 폴더에 실제 파일 생성
  - 웹 UI에서 코드 쓰기 현황 실시간 표시
- 코드 리뷰 루프
  - 한 역할이 파일을 생성하면 다른 역할들이 리뷰
  - `support / refine / challenge`로 평가
  - 필요하면 같은 역할이 수정 라운드를 다시 수행
- 테스트 에이전트 추가
  - 토론 참여
  - 테스트 명세 생성
  - 테스트 파일 생성
  - 리뷰 시 품질 게이트 역할 수행
- 모델별 파라미터 중앙 관리
  - `src/llm/modelProfiles.ts`
  - 단계별, 모델 계열별 파라미터 분리

## 최근 변경

이번 리팩터링에서 특히 달라진 부분은 두 가지입니다.

### 1. 테스트 에이전트 추가

이제 역할은 총 6개입니다.

- PM
- Backend
- Frontend
- AI
- Infra
- Test

테스트 에이전트는 단순히 “테스트가 필요하다”라고 말만 하는 역할이 아닙니다.
현재는 아래 단계에 실제로 참여합니다.

- 자유 토론에서 테스트 전략, 회귀 위험, 검증 우선순위 제안
- `test-spec.md` 생성
- 구현 계획에서 `task-06` 테스트 태스크 소유
- 코드 생성 단계에서 `tests/*.test.mjs` 파일 생성
- 코드 리뷰 단계에서 품질 게이트 역할 수행

생성되는 테스트 파일 예시는 다음과 같습니다.

- `tests/bootstrap.test.mjs`
  - `/api/health`
  - `/api/bootstrap`
  - 서버 부팅 여부 확인
- `tests/contracts.test.mjs`
  - shared contract export 체크
  - bootstrap payload 구조 기본 확인

### 2. 모델별 파라미터 중앙화

이전에는 각 에이전트 파일마다 `temperature`, `numPredict`, `maxRetries`가 흩어져 있었습니다.
지금은 모두 `src/llm/modelProfiles.ts`로 이동했습니다.

이 구조로 바뀌면서 생긴 장점:

- `qwen3`, `llama`, `deepseek`, `gemma`, `mistral`, `qwen-coder` 계열별 튜닝 가능
- `discussion`, `spec`, `codegen` 같은 단계별 최적화 가능
- 모델 교체 시 숫자를 여러 파일에서 직접 수정할 필요 없음
- 코드 생성 단계만 더 보수적으로 설정하는 식의 운영이 가능

## 시스템 흐름

현재 오케스트레이션 흐름은 아래 순서로 고정되어 있습니다.

1. 사용자 요청 수신
2. PM 초기 문제 정의
3. 자유 토론
4. 추가 질문 필요 여부 판단
5. 사용자 답변 반영
6. PM 최종 결정
7. 역할별 명세 생성
8. 구현 계획 생성
9. Build Brief 생성
10. 실제 코드 생성
11. 역할 간 코드 리뷰
12. 필요 시 수정 라운드 재진행

중요한 점은 “토론만 하고 끝나는 시스템”이 아니라는 점입니다.
현재는 명세 이후에 실제 파일 생성과 리뷰 루프까지 연결되어 있습니다.

## 에이전트 역할

### PM

- 사용자 요청 해석
- MVP 범위 정의
- 토론 정리
- 최종 방향 결정
- 구현 시작 메시지와 마무리 메시지 담당

### Backend

- API 구조 제안
- 데이터 모델 제안
- 서버 진입점 및 shared contract 중심 코드 생성

### Frontend

- UI 구조
- 화면 흐름
- 사용자 경험 기준
- 정적 프론트 파일 생성

### AI

- 도메인 인사이트 로직
- 분석/추천 구조
- 가드레일과 위험 요소 제안

### Infra

- 실행 환경
- `.env.example`
- `Dockerfile`
- 운영 문서

### Test

- smoke test 전략
- contract test 전략
- 품질 게이트
- 리뷰 시 blocking issue 제기

## 자유 토론 구조

이 시스템은 더 이상 `PM > Frontend > Backend` 같은 고정 직렬 구조가 아닙니다.

현재는 다음 원칙으로 동작합니다.

- PM이 첫 메시지를 쓴다.
- 중간 역할들은 동적으로 순서를 바꿔가며 토론한다.
- 각 역할은 이전 메시지 ID를 읽고 특정 메시지에 반응한다.
- 반응 타입은 `challenge`, `support`, `refine` 중 하나다.
- PM이 마지막에 정리하고 결론을 내린다.

즉, 완전 랜덤 토론은 아니지만, 엄격한 파이프라인보다 훨씬 팀 대화에 가깝게 설계되어 있습니다.

## 코드 생성 및 리뷰 루프

구현 단계에서는 아래 흐름이 반복됩니다.

1. 특정 역할이 코드 번들을 생성한다.
2. 다른 역할들이 생성된 파일을 읽고 코드 리뷰를 남긴다.
3. 리뷰 결과가 모두 `support`면 다음 역할로 넘어간다.
4. `refine` 또는 `challenge`가 있으면 수정 라운드를 진행한다.
5. 최대 라운드 제한에 도달하면 PM이 중단 메시지를 남긴다.

리뷰 메시지에는 다음 정보가 포함됩니다.

- `Approved Areas`
- `Findings`
- `Assessment`
- `Adjustment`

즉, 지금은 기획 토론뿐 아니라 구현 단계에서도 상호 검토가 이어집니다.

## 추가 질문 루프

모든 요청을 한 번에 다 이해한다고 가정하지 않습니다.
필요하면 시스템이 사용자에게 추가 질문을 보냅니다.

질문 특징:

- 최대 3개
- `api`, `data`, `ui`, `ai`, `infra`, `test` 주제로 분류
- 같은 세션을 멈추고 사용자 답변을 기다림
- 답변이 들어오면 세션을 이어서 재개

웹 UI에서는 질문 카드와 답변 입력 폼이 바로 보입니다.

## 산출물

세션 실행 후 생성되는 문서는 기본적으로 아래와 같습니다.

- `backend-spec.md`
- `frontend-spec.md`
- `ai-features.md`
- `infra-spec.md`
- `test-spec.md`
- `implementation-plan.md`
- `build-brief.md`

각 문서는 markdown 형식으로 저장되며, 웹 UI에서 바로 미리보기와 다운로드가 가능합니다.

## 코드 생성 결과

문서만 만드는 것이 아니라 실제 코드 파일도 생성합니다.

역할별 기본 출력 성격:

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

웹 UI에서는 현재 어떤 역할이 어떤 파일을 쓰고 있는지도 표시합니다.
VS Code에서 같은 타깃 폴더를 열어두면 파일 생성/수정을 바로 볼 수 있습니다.

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

### 3. 웹 UI 실행

```powershell
npm run web
```

브라우저:

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
npm run dev -- "공시자료와 뉴스, 포트폴리오 분석을 연결하는 취업 인사이트 앱을 만들어줘"
```

코드 타깃 폴더 지정:

```powershell
npm run dev -- --target-dir C:\Users\SSAFY\Desktop\multi-agent-workspace "실제 코드 파일까지 생성해줘"
```

## 주요 스크립트

```powershell
npm run check
npm run build
npm run web
npm run dev -- --example
npm run claw-dev
```

설명:

- `npm run check`
  - TypeScript 타입 체크
- `npm run build`
  - 프로젝트 빌드
- `npm run web`
  - 웹 서버 실행
- `npm run dev`
  - CLI 기반 멀티 에이전트 실행
- `npm run claw-dev`
  - 기존 Claw Dev 런처 실행

## 모델 설정

기본 모델은 `qwen3` 입니다.

환경 변수:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3
MULTI_AGENT_PORT=3030
AGENT_OUTPUT_DIR=.multi-agent-output
```

### 공통 호출 정책

현재 Ollama 호출은 다음 원칙으로 고정되어 있습니다.

- `stream: false`
- `think: false`
- 구조화 출력은 `format: "json"`

즉, 현재 시스템은 긴 thinking trace를 받는 방식보다 구조화 JSON 안정성과 파이프라인 일관성을 우선합니다.

### 단계별 파라미터 프로파일

파라미터는 `src/llm/modelProfiles.ts` 에서 단계별로 분리되어 있습니다.

기본 stage:

- `pm-initial`
- `pm-final`
- `clarification`
- `discussion`
- `spec`
- `implementation-plan`
- `build-brief`
- `codegen`

`qwen3` 기준 현재 대표값:

- `pm-initial`
  - `temperature 0.12`
  - `numPredict 520`
  - `maxRetries 5`
  - `topP 0.82`
  - `topK 20`
- `discussion`
  - `temperature 0.12`
  - `numPredict 640`
  - `maxRetries 5`
  - `topP 0.82`
  - `topK 24`
- `spec`
  - `temperature 0.10`
  - `numPredict 920`
  - `maxRetries 5`
  - `topP 0.78`
  - `topK 20`
- `implementation-plan`
  - `temperature 0.08`
  - `numPredict 820`
  - `maxRetries 5`
  - `topP 0.78`
  - `topK 18`
- `build-brief`
  - `temperature 0.08`
  - `numPredict 920`
  - `maxRetries 5`
  - `topP 0.76`
  - `topK 18`
- `codegen`
  - `temperature 0.05`
  - `numPredict 1700`
  - `maxRetries 4`
  - `topP 0.72`
  - `topK 18`
  - `repeatPenalty 1.10`

### 모델 계열별 오버라이드

현재 다음 계열을 인식합니다.

- `qwen3`
- `qwen-coder`
- `deepseek`
- `llama`
- `gemma`
- `mistral`
- `generic`

즉, 나중에 모델을 바꿔도 각 에이전트 파일을 일일이 열지 않고 프로파일 파일만 조정하면 됩니다.

## 웹 UI에서 볼 수 있는 것

웹 UI에서 확인 가능한 항목:

- 세션 상태
- 단계별 진행 상황
- 실시간 채팅 로그
- PM 최종 결정
- 추가 질문 및 사용자 응답
- 생성된 문서 목록
- 코드 타깃 폴더
- 코드 쓰기 현황
  - 현재 역할
  - 현재 파일
  - 완료된 파일

## 아키텍처

### 서버

- `src/server.ts`
  - HTTP 서버
  - 세션 생성 API
  - SSE 이벤트 스트림
  - artifact 다운로드
- `src/server/sessionStore.ts`
  - 메모리 기반 세션 저장
  - transcript
  - phase
  - clarification
  - code activity 관리

### 오케스트레이터

- `src/orchestrator/multiAgentOrchestrator.ts`
  - 전체 흐름 제어
  - 자유 토론
  - 사용자 질문 루프
  - 명세 생성
  - build brief 생성
  - 코드 생성
  - 리뷰 루프
- `src/orchestrator/chatState.ts`
  - 채팅 메시지 상태 관리
- `src/orchestrator/outputWriter.ts`
  - markdown 산출물과 generated code 기록

### 에이전트

- `src/agents/pmAgent.ts`
- `src/agents/backendAgent.ts`
- `src/agents/frontendAgent.ts`
- `src/agents/aiAgent.ts`
- `src/agents/infraAgent.ts`
- `src/agents/testAgent.ts`
- `src/agents/reactionAgent.ts`
- `src/agents/clarificationAgent.ts`
- `src/agents/implementationPlanner.ts`
- `src/agents/codegenAgent.ts`
- `src/agents/codingAgent.ts`
- `src/agents/codeScaffolder.ts`

### 프롬프트 / 하네스

- `src/harness/promptHarness.ts`
- `src/prompts/pm.ts`
- `src/prompts/backend.ts`
- `src/prompts/frontend.ts`
- `src/prompts/ai.ts`
- `src/prompts/infra.ts`
- `src/prompts/test.ts`
- `src/prompts/reaction.ts`
- `src/prompts/clarification.ts`
- `src/prompts/implementation.ts`
- `src/prompts/buildBrief.ts`
- `src/prompts/codegen.ts`

### LLM 계층

- `src/llm/ollamaClient.ts`
  - Ollama chat 호출
  - structured JSON 파싱
  - `top_p`, `top_k`, `repeat_penalty` 전달
- `src/llm/modelProfiles.ts`
  - 모델 계열별 / 단계별 파라미터 프로파일

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

## 현재 한계

이 저장소는 이미 “문서 생성기” 수준은 넘었지만, 아직 완전한 범용 앱 빌더라고 말하기는 이릅니다.

현재 남아 있는 한계:

- 세션 저장이 메모리 기반이다.
  - 서버 재시작 시 세션이 사라진다.
- 기존 대형 리포지토리를 정교하게 분석해서 부분 수정하는 모드는 아직 약하다.
- 코드 생성은 범용화가 많이 진행됐지만, 여전히 deterministic fallback에 의존하는 구간이 있다.
- 긴 end-to-end 실행은 `qwen3` 속도에 영향을 많이 받는다.
- `think: true`, `stream: true` 기반의 세밀한 토큰 스트리밍 UX는 아직 기본 경로가 아니다.

## 다음에 밀면 좋은 방향

- 세션 영속 저장
- 기존 리포지토리 수정 모드 강화
- 테스트 에이전트의 실제 실행 결과를 리뷰 루프에 더 깊게 반영
- 단계별 모델 혼합 운영
  - 예: 토론은 소형 모델, codegen만 상위 모델
- 스트리밍 UI 강화
  - 토큰 단위
  - patch 단위
  - 파일 diff 단위
