# Claw Dev Multi-Agent Project Report

## 1. 이 프로젝트가 추구하는 것

이 프로젝트의 목표는 단순한 "역할극 챗봇"이 아닙니다. 우리가 추구하는 것은 아래와 같습니다.

- 사용자가 제품 아이디어를 던지면, 여러 역할의 에이전트가 같은 맥락을 공유한 채 토론한다.
- PM이 범위를 잡고, Backend / Frontend / AI / Infra / Test가 서로의 의견을 읽고 반박·보완·지지한다.
- 에이전트가 스스로 결정 가능한 설계는 내부 토론으로 끝낸다.
- 사용자는 에이전트가 알 수 없는 외부 정보가 필요할 때만 개입한다.
  - 예: DART API 키, Google OAuth, 서비스 계정, 승인 여부, 실제 연동 대상
- 토론이 문서 생성으로만 끝나지 않고 실제 코드 작성으로 이어진다.
- 코드 작성 후에는 역할 간 리뷰, 실행 검증, 수정 라운드까지 이어진다.
- 같은 타깃 폴더를 다시 지정하면 이전 작업을 기억하고 이어서 개발한다.

한 줄로 정리하면, 이 프로젝트의 목적은 아래 문장으로 압축됩니다.

> "사용자와 함께 기획하고, 에이전트끼리 토론하고, 실제 코드까지 작성·검증·수정하는 진짜 오케스트라에 가까운 멀티 에이전트 개발 시스템"

---

## 2. 왜 이렇게 발전시켰는가

처음에는 로컬 모델을 Claude 호환 방식으로 쓰기 위한 래퍼와 프록시가 중심이었습니다. 그 위에 멀티 에이전트 구조를 얹기 시작했지만, 초반 구현은 "토론 후 문서 생성"에 가까웠습니다.

이후 사용자 요구가 분명해졌습니다.

- 단순한 스펙 생성기가 아니라 실제로 코드를 만드는 시스템이 필요했다.
- 대화 순서가 기계적이면 안 됐다.
- 사용자가 설계를 대신 결정하는 구조도 원하지 않았다.
- 생성 결과를 실제 바탕화면 폴더에서 보고 싶었다.
- 에이전트가 코드 작성 뒤에도 서로 리뷰하고, 테스트하고, 고치길 원했다.

그래서 프로젝트는 아래 방향으로 계속 리팩터링됐습니다.

- `strict sequence` -> `PM 시작 / 중간 자유 토론 / PM 종료`
- `문서 생성 시스템` -> `문서 + 코드 생성 시스템`
- `일회성 실행` -> `상태 기반 이어서 개발`
- `정적 scaffold` -> `리뷰 기반 수정 라운드`
- `설계 질문 남발` -> `외부 입력만 질문`

---

## 3. 현재 시스템의 정의

현재 `Claw Dev Multi-Agent Workspace`는 다음으로 정의할 수 있습니다.

- 단일 LLM 기반 오케스트레이션 시스템
- 기본 모델: `Ollama qwen3.5`
- 실행 환경: 로컬 Windows + Node.js + TypeScript
- 인터페이스:
  - 웹 UI
  - CLI
- 산출물:
  - 역할별 명세 문서
  - 구현 계획
  - build brief
  - 실제 코드 파일
  - 테스트 파일
- 상태 관리:
  - 세션 메모리
  - 프로젝트 메모리

현재 주요 역할은 6개입니다.

- `PM`
- `Backend`
- `Frontend`
- `AI`
- `Infra`
- `Test`

---

## 4. 아키텍처 관점에서의 핵심 축

### 4.1 오케스트레이션 축

핵심 제어는 [src/orchestrator/multiAgentOrchestrator.ts](./src/orchestrator/multiAgentOrchestrator.ts) 에 있습니다.

이 파일이 담당하는 것:

- 토론 단계 제어
- clarification 요청 여부 판단
- PM 최종 결정
- spec 생성
- implementation plan 생성
- build brief 생성
- codegen 실행
- 리뷰 라운드 관리
- PM 개입
- 검증 결과 반영

### 4.2 에이전트 축

각 역할은 `src/agents` 아래 함수 단위로 분리되어 있습니다.

- 토론/명세용 에이전트
  - `pmAgent.ts`
  - `backendAgent.ts`
  - `frontendAgent.ts`
  - `aiAgent.ts`
  - `infraAgent.ts`
  - `testAgent.ts`
- 보조 에이전트
  - `clarificationAgent.ts`
  - `reactionAgent.ts`
  - `implementationPlanner.ts`
  - `buildBriefAgent.ts`
  - `codegenAgent.ts`
  - `codingAgent.ts`

### 4.3 프롬프트 축

역할별 프롬프트는 `src/prompts`에 있고, 공통 룰은 `src/harness/promptHarness.ts`가 담당합니다.

즉 프롬프트도 이제 단순 문자열이 아니라 다음 모드로 분리된 하네스 구조입니다.

- discussion
- clarification
- spec
- implementation
- build-brief
- coding
- code-review

### 4.4 메모리 축

현재 메모리는 두 층입니다.

- 세션 메모리
  - [src/server/sessionStore.ts](./src/server/sessionStore.ts)
  - 현재 세션의 메시지, 단계, artifact, clarification 답변 저장
- 프로젝트 메모리
  - [src/orchestrator/projectMemory.ts](./src/orchestrator/projectMemory.ts)
  - 같은 타깃 폴더를 다시 사용할 때 이어서 개발 가능

프로젝트 메모리 저장 경로:

- `<targetDirectory>/.multi-agent/project-memory.json`

### 4.5 검증 축

코드가 생성되면 끝이 아니라 검증이 따라옵니다.

- `node --check`
- `tsc --noEmit`
- `node --test`

검증은 [src/orchestrator/workspaceVerifier.ts](./src/orchestrator/workspaceVerifier.ts) 에서 담당합니다.

---

## 5. 커밋별 발전 타임라인

아래는 지금까지의 흐름을 커밋 기준으로 정리한 보고서입니다.

### 5.1 기반 구축 단계

#### `2742bde` `Initial Claw Dev`

출발점입니다.

- `Leonxlnx-claude-code` 기반 런처/벤더 코드를 루트에 가져왔습니다.
- `src/anthropicCompatProxy.ts`, `src/index.ts`, `src/providers.ts` 등 기본 실행 구조가 존재했습니다.
- 아직 이 시점의 핵심은 멀티 에이전트가 아니라, 로컬 모델을 Claude 호환 흐름으로 사용할 수 있게 하는 환경 구축이었습니다.

의미:

- 이후 모든 멀티 에이전트 실험의 토대가 된 런처 기반 저장소가 만들어졌습니다.

#### `88adf04` `Load environment variables from .env file in claw-dev-launcher.js`

- `.env` 기반 설정 로딩을 런처에 붙였습니다.
- 실행 설정 유연성이 올라갔고, API 키나 모델 지정이 쉬워졌습니다.

의미:

- 로컬 실행 환경을 반복 실험 가능한 상태로 만든 초기 정비 커밋입니다.

#### `31c6449` `Merge pull request #1 from duolahypercho/main`

- 상류 변경을 병합한 시점입니다.

의미:

- 본격적인 멀티 에이전트 작업 직전의 정리 지점입니다.

#### `60d6d48` `Add flexible multi-provider model selection to Claw Dev`

- 여러 provider를 유연하게 선택하는 구조를 붙였습니다.
- `.env.example`, `src/anthropicCompatProxy.ts`, launcher, README가 바뀌었습니다.

의미:

- 특정 모델에 고정되지 않고, 로컬 모델 프록시 기반 확장이 가능해졌습니다.

#### `4629890` `Fix launcher model sync for proxied providers`

- 프록시 모델 전달 누락 문제를 수정했습니다.
- launcher와 실제 프록시 모델명이 어긋나는 문제를 고쳤습니다.

의미:

- 이후 `qwen3.5` 기반 실험이 안정적으로 돌기 시작한 실질적인 기반 수정입니다.

---

### 5.2 멀티 에이전트 1차 구현 단계

#### `be7b394` `Implement multi-agent collaboration orchestrator`

첫 번째 큰 전환점입니다.

- PM / Backend / Frontend / AI 에이전트를 추가했습니다.
- 오케스트레이터, chat state, console reporter, output writer를 만들었습니다.
- 역할별 프롬프트와 구조화 타입을 추가했습니다.
- 결과물로 markdown spec을 생성하는 첫 버전이 완성됐습니다.

이 시점의 성격:

- "토론 후 문서 생성 시스템"

의미:

- 멀티 에이전트의 핵심 구조가 처음으로 코드베이스 안에 생겼습니다.

#### `d42c6f2` `Add Korean multi-agent web collaboration UI`

두 번째 큰 전환점입니다.

- 웹 UI를 추가했습니다.
- `public/index.html`, `public/app.js`, `public/styles.css`가 생겼습니다.
- `src/server.ts`, `src/server/sessionStore.ts`가 추가됐습니다.
- CLI 전용이던 것을 브라우저에서 볼 수 있게 만들었습니다.
- 한국어 UI와 한국어 프롬프트/로그로 정리했습니다.

이 시점의 성격:

- "터미널 프로토타입" -> "브라우저에서 볼 수 있는 시스템"

의미:

- 사용자가 실시간으로 에이전트 대화를 보는 기반이 생겼습니다.

#### `27eb497` `Refactor prompts into shared harness`

- 프롬프트를 공통 하네스로 정리했습니다.
- 역할별 프롬프트 중복을 줄였습니다.

의미:

- 이후 discussion / spec / implementation 단계 확장에 필요한 프롬프트 구조가 만들어졌습니다.

#### `728dc9a` `Add implementation planning execution phase`

- implementation plan 생성 단계를 추가했습니다.
- `implementation-plan.md`를 산출물에 포함했습니다.

이 시점의 성격:

- "무엇을 만들까?"에서 "어떻게 만들까?"까지 확장

의미:

- 단순 spec을 넘어 실제 구현 착수 계획을 출력하게 됐습니다.

---

### 5.3 토론 고도화와 코딩 단계 진입

#### `547ea68` `Add dynamic multi-agent discussion flow`

세 번째 큰 전환점입니다.

- 엄격한 고정 순서를 버리고 자유 토론형 구조를 도입했습니다.
- `reactionAgent.ts`, `reaction.ts`가 추가됐습니다.
- 에이전트가 특정 메시지 ID에 반응하도록 만들었습니다.
- `support`, `refine`, `challenge` 개념의 시작점입니다.

이 시점의 성격:

- "딱딱한 순차 시스템" -> "상호 반응형 채팅방"

의미:

- 사용자가 원했던 "서로 토론하는 느낌"에 한 걸음 가까워졌습니다.

#### `d280407` `Add collaborative coding execution stage`

네 번째 큰 전환점입니다.

- 코드 생성 단계를 추가했습니다.
- `codeScaffolder.ts`, `codingAgent.ts`, `prompts/coding.ts`가 들어왔습니다.
- markdown만 만들던 시스템이 실제 코드 파일 생성까지 가기 시작했습니다.

이 시점의 성격:

- "문서 생성기" -> "코드 생성기"

의미:

- 이후 모든 "진짜 오케스트라" 논의의 출발점이 된 커밋입니다.

#### `9e0df23` `Add infra agent and clarification workflow`

- `Infra` 역할을 추가했습니다.
- clarification 단계와 사용자 답변 루프를 도입했습니다.
- 설계가 모호할 때 질문을 던지고 다시 이어가는 흐름이 생겼습니다.

의미:

- 처음으로 "사용자와 협업하면서 개발"하는 순환 구조가 만들어졌습니다.

#### `ba3bbe5` `Add desktop target directory output mode`

- 생성 코드를 임시 폴더가 아니라 실제 타깃 디렉터리에 쓰도록 했습니다.
- 바탕화면 폴더를 열어둔 VS Code에서 결과를 바로 확인할 수 있게 했습니다.

의미:

- 결과물이 추상적 문서가 아니라 실제 파일이 되는 체감이 생겼습니다.

#### `3fc6ee6` `Add live code write activity stream`

- 웹 UI에 실시간 코드 쓰기 현황을 붙였습니다.
- 어떤 역할이 어떤 파일을 쓰는지 표시되게 했습니다.

의미:

- "토론"뿐 아니라 "실시간 작업 중"인 느낌을 UI에 반영한 커밋입니다.

#### `5618169` `Translate README to Korean`

- README를 한국어화했습니다.

의미:

- 프로젝트를 실제 사용자가 이해할 수 있는 문서 상태로 바꾸기 시작한 첫 정리입니다.

---

### 5.4 범용 코드 생성기로의 피벗

#### `215d4f9` `Refactor multi-agent pipeline into generic code generation`

다섯 번째 큰 전환점입니다.

- `buildBriefAgent.ts`, `codegenAgent.ts`, `prompts/buildBrief.ts`, `prompts/codegen.ts`가 추가됐습니다.
- 파이프라인이 더 일반화됐습니다.
- 특정 앱용 스캐폴딩을 넘어서, build brief를 기반으로 코드 생성을 시도하는 구조로 전환했습니다.

이 시점의 성격:

- "특정 데모용 스타터 생성" -> "범용 코드 생성 파이프라인"

의미:

- 사용자가 어떤 앱을 요청하더라도 대응하려는 방향이 코드에 처음 반영된 지점입니다.

#### `ac73692` `Fix CLI argument parsing for npm run dev`

- `npm run dev -- --output-dir ... --target-dir ...` 전달 문제를 고쳤습니다.
- `.gitignore`도 정리했습니다.

의미:

- CLI 사용성이 실제 수준으로 올라간 정비 커밋입니다.

---

### 5.5 테스트, 모델 프로파일, 상태성 강화

#### `6f2e06c` `Add test agent to multi-agent review loop`

여섯 번째 큰 전환점입니다.

- `Test` 역할이 추가되었습니다.
- `testAgent.ts`, `prompts/test.ts`가 생겼습니다.
- 토론, 명세, 구현, 리뷰에 테스트 시각이 들어왔습니다.
- `test-spec.md`와 테스트 파일 생성이 가능해졌습니다.

의미:

- "만드는 팀"에서 "검증하는 팀"으로 확장된 순간입니다.

#### `95be6d1` `Centralize model-specific Ollama generation profiles`

- 모델별 파라미터 프로파일을 [src/llm/modelProfiles.ts](./src/llm/modelProfiles.ts) 로 모았습니다.
- `qwen3.5`, `deepseek`, `llama`, `gemma`, `mistral`, `qwen-coder` 계열을 고려했습니다.

의미:

- 모델을 바꿔도 단계별 품질/속도를 조정할 수 있게 된 운영성 개선입니다.

#### `707b6c9` `Rewrite README for test agent and model profiles`

- 테스트 에이전트와 모델 프로파일 도입 이후 README를 다시 정리했습니다.

의미:

- 프로젝트 설명이 구현을 따라가도록 맞춘 문서 정비 단계입니다.

#### `0e97620` `Make orchestration stateful and revision-driven`

일곱 번째 큰 전환점입니다.

- 프로젝트 메모리를 추가했습니다.
- 같은 타깃 폴더를 대상으로 하면 이전 상태를 읽고 이어서 개발하게 했습니다.
- 수정 라운드가 fallback 재생성이 아니라 실제 revise 흐름으로 이동했습니다.

이 시점의 성격:

- "세션 단위 생성기" -> "프로젝트 단위 개발자"

의미:

- 흉내내는 오케스트라에서 실제 축적형 시스템으로 넘어가는 핵심 커밋입니다.

#### `d430e53` `Add LLM code review and workspace verification`

- 코드 리뷰를 LLM 기반으로 강화했습니다.
- `workspaceVerifier.ts`를 추가해 실제 워크스페이스 검증을 돌리기 시작했습니다.

의미:

- "파일을 읽고 말만 하는 리뷰"에서 "실행 결과를 보고 판단하는 리뷰"로 올라선 지점입니다.

#### `761b5f8` `Let PM intervene in review rounds`

- 리뷰 라운드 중 문제가 생기면 PM이 직접 병목과 우선순위를 요약하게 했습니다.

의미:

- PM이 단순 시작/종료 역할이 아니라, 수정 라운드를 제어하는 진짜 리더 역할로 올라왔습니다.

#### `9beb6c6` `Expose project continuation state in UI`

- 웹 UI에서 타깃 폴더가 새 프로젝트인지, 이어서 개발인지 미리 보여주게 했습니다.
- 프로젝트 continuation 상태가 사용자 눈에 보이게 됐습니다.

의미:

- 상태 기반 시스템이 내부 로직만이 아니라 UI 경험에도 반영된 커밋입니다.

#### `8f2f653` `Narrow clarification to external inputs only`

- clarification을 대폭 축소했습니다.
- 설계 질문은 에이전트 내부 토론으로 넘기고, 사용자는 외부 정보만 입력하게 했습니다.

의미:

- 시스템 책임과 사용자 책임의 경계를 정리한 매우 중요한 커밋입니다.

#### `8765f43` `Update README for stateful multi-agent workflow`

- 상태 기반 오케스트레이션, PM 개입, 검증 루프, 외부 입력-only clarification 정책을 README에 반영했습니다.

의미:

- 현재 시스템 정의가 문서에 제대로 반영된 최신 정리 커밋입니다.

---

## 6. 현재 기준으로 우리가 만든 것

지금 시점의 시스템은 아래처럼 요약할 수 있습니다.

### 6.1 사용자 경험

사용자는 웹 UI 또는 CLI에서 요청을 넣습니다.

이후 시스템은:

- PM이 문제를 정의하고
- 다른 에이전트가 자유 토론을 하고
- 외부 입력이 필요할 때만 질문하고
- 최종 방향을 정하고
- 문서를 만들고
- 실제 코드를 타깃 폴더에 쓰고
- 서로 리뷰하고
- 실행 검증을 돌리고
- 수정 라운드를 반복합니다.

### 6.2 개발자 경험

개발자는:

- 웹 UI에서 토론 상황을 볼 수 있고
- 코드 쓰기 현황을 볼 수 있고
- 같은 폴더를 다시 대상으로 잡아 이어서 개발할 수 있고
- VS Code에서 실시간으로 생성/수정 파일을 볼 수 있습니다.

### 6.3 운영 관점

현재 기본 모델은 `qwen3.5`이며, 단계별 파라미터는 모델 프로파일에서 조정됩니다.

웹 서버 헬스 체크에서 볼 수 있는 기본 정보:

- 모델
- base URL
- 기본 타깃 폴더

---

## 7. 지금 시스템의 강점

### 7.1 단순 역할극을 넘은 구조

이 시스템은 이미 단순히 역할별로 한 마디씩 말하는 수준은 넘었습니다.

- 자유 토론
- 반응 메시지
- 코드 생성
- 역할 간 리뷰
- 검증
- 수정
- 프로젝트 메모리

까지 포함합니다.

### 7.2 사용자 개입 최소화

이전에는 사용자가 설계까지 대신 정해야 할 위험이 있었습니다.

지금은:

- 설계는 에이전트가 토론해서 결정
- 사용자는 외부 credential / auth / integration / approval만 제공

이라는 원칙으로 정리됐습니다.

### 7.3 실제 파일 중심

결과가 markdown에만 머무르지 않고 실제 워크스페이스 파일에 반영됩니다.

이 점은 단순 문서 생성기와 가장 큰 차이입니다.

### 7.4 상태 기반 이어서 개발

같은 폴더를 다시 대상으로 잡았을 때 기억을 이어간다는 점은, 멀티 에이전트 시스템이 일회성 데모를 넘는 중요한 지점입니다.

---

## 8. 아직 남아 있는 한계

### 8.1 오케스트레이터 책임 집중

[src/orchestrator/multiAgentOrchestrator.ts](./src/orchestrator/multiAgentOrchestrator.ts) 에 책임이 많이 몰려 있습니다.

문제:

- 토론
- 질문
- 명세
- 구현 계획
- build brief
- 코드 생성
- 리뷰
- PM 개입
- 검증 반영

이 한 파일에 강하게 집중돼 있습니다.

의미:

- 지금은 동작하지만, 더 커지면 유지보수와 디버깅 비용이 커질 수 있습니다.

### 8.2 여전히 존재하는 fallback 의존

LLM 실패 시 완전히 멈추지 않도록 fallback을 넣어둔 것은 장점이지만, 반대로 말하면 아직 모든 단계가 순수 추론 기반으로 안정적이지는 않습니다.

### 8.3 긴 실행 시간

`qwen3.5` 기반 긴 end-to-end 실행은 여전히 시간이 걸립니다.

특히:

- 토론
- spec
- build brief
- codegen
- review

까지 연속으로 이어질 때 병목이 생길 수 있습니다.

### 8.4 장기 지식 저장의 한계

프로젝트 메모리는 파일 기반이라 실용적이지만, 아직 조직 단위 장기 기억이나 의미 기반 검색 메모리까지는 아닙니다.

### 8.5 범용성의 끝 검증은 아직 진행형

현재 구조는 범용 앱 빌더로 가기 위한 기반을 많이 갖췄지만, "어떤 앱이나 웹이 와도 동일한 품질로 잘 만든다"는 수준은 아직 더 검증이 필요합니다.

---

## 9. 이 프로젝트가 의미 있는 이유

이 프로젝트의 진짜 의미는 특정 앱 하나를 잘 만드는 데만 있지 않습니다.

우리가 만들고 있는 것은:

- 기획을 같이 하는 시스템
- 사용자에게 꼭 필요한 정보만 묻는 시스템
- 역할별로 토론하는 시스템
- 문서화에 머무르지 않고 코드를 쓰는 시스템
- 리뷰와 검증을 통해 스스로 수정하는 시스템
- 이전 작업을 기억하는 시스템

즉, "기획부터 구현까지 이어지는 로컬 멀티 에이전트 개발팀"에 가까운 형태입니다.

---

## 10. 앞으로의 우선순위

현재 기준으로 다음 우선순위는 아래가 적절합니다.

### 1. 오케스트레이터 분해

- phase 단위 분리
- 리뷰 루프 분리
- clarification 정책 분리

### 2. 프로젝트 메모리 고도화

- 이전 artifact / code / finding 검색 강화
- 프로젝트 히스토리 UI 분리

### 3. 검증 루프 강화

- 테스트 실패 기반 자동 수정 라운드 강화
- 역할별 실패 분석 템플릿 도입

### 4. 모델 혼합 전략

- discussion은 가벼운 모델
- codegen / review는 더 강한 모델
- 단계별 모델 선택 정책 정리

### 5. 범용 코드 생성 품질 검증

- 앱 유형별 benchmark 시나리오 정리
- 요청 종류별 품질 비교

---

## 11. 결론

지금까지의 흐름을 한 문장으로 정리하면 이렇습니다.

> 이 프로젝트는 로컬 Claude 호환 실행기에서 출발해, 자유 토론, 최소 사용자 질문, 실제 코드 생성, 리뷰와 검증, 프로젝트 메모리를 갖춘 상태 기반 멀티 에이전트 개발 시스템으로 진화해 왔습니다.

아직 완성형은 아닙니다. 하지만 이제는 더 이상 "역할극 챗봇"이나 "문서 생성기"라고 부르기 어렵습니다. 현재 구조는 이미 `기획 -> 설계 -> 코드 생성 -> 리뷰 -> 검증 -> 수정`의 루프를 갖고 있으며, 목표는 분명합니다.

우리가 만들고 있는 것은:

- 사람이 하나하나 설계 결정을 내려줘야 하는 도우미가 아니라
- 스스로 논의하고, 필요한 외부 정보만 사용자에게 묻고
- 실제 구현까지 밀고 가는 로컬 멀티 에이전트 개발 팀

입니다.
