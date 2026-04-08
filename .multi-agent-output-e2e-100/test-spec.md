# 테스트 명세

## PM 최종 방향
구조화 응답이 흔들려도 검증 기준이 사라지지 않도록 테스트 명세를 deterministic fallback으로 복원합니다. 생성된 코드가 실제로 실행되고 역할 간 계약이 맞는지 빠르게 확인할 수 있는 검증 흐름을 먼저 고정해야 합니다. PM 최종 결정은 백엔드 상태 의존성을 제거하고 클라이언트 측 로컬 스토리지로 타이머 로직을 독립화하여, 브라우저 정책과 네트워크 불안정에도 불구하고 로딩 시 즉시 실행되는 정적 웹앱을 배포한다.

### 최종 MVP 범위
- 백엔드 상태 의존성을 제거하고 클라이언트 측 로컬 스토리지로 타이머 로직을 독립화하여, 브라우저 정책과 네트워크 불안정에도 불구하고 로딩 시 즉시 실행되는 정적 웹앱을 배포한다.
- 브라우저 로딩 시 즉시 실행 가능한 정적 웹앱 배포 (Static Hosting)
- 클라이언트 측 로컬 스토리지 (localStorage) 기반 타이머 상태 (running/paused/reset) 관리
- 사용자 상호작용 (클릭 등) 을 통한 타이머 시작 로직 구현
- 백엔드 API: 파일 생성 및 다운로드 엔드포인트 제공
- Ollama 응답 불안정 대비 SSE 스트림 유지 및 세션 복원 로직
- UI 진행 상황 표시를 위한 비동기 작업 처리

## 테스트 전략
- 핵심 엔드포인트에 대한 smoke test를 만든다.
- 공유 contract와 실제 bootstrap payload의 일치를 확인하는 contract test를 만든다.
- 빌드 후 앱이 실제로 뜨는지 확인하는 기본 실행 검증을 포함한다.
- 핵심 엔드포인트에 대한 smoke test를 먼저 둔다.
- 공유 contracts와 실제 응답 payload를 맞추는 contract test를 둔다.
- 빌드 후 서버가 실제로 뜨는지 기본 실행 검증을 둔다.

## 핵심 시나리오
- 첫 실행 경로가 실제로 동작하는지 검증한다.
- 역할별 생성 파일이 서로 충돌하지 않고 연결되는지 확인한다.
- GET /api/health가 200과 앱 메타데이터를 반환한다.
- GET /api/bootstrap이 필수 필드를 포함한 bootstrap payload를 반환한다.
- 생성된 프론트가 bootstrap 데이터를 받아 화면에 렌더링한다.

## 품질 게이트
- 테스트 스크립트 없이 코드만 생성되면 회귀가 누적될 수 있습니다.
- API 스키마와 프론트 렌더링 포인트가 어긋나면 앱이 빈 화면처럼 보일 수 있습니다.
- 빌드와 smoke test 중 하나라도 실패하면 다음 배포 단계로 넘기지 않는다.
- 공유 contract가 깨지면 프론트와 백엔드 모두 수정 대상으로 표시한다.

## 구현 단계
- 1 단계: 프론트엔드 정적 파일 (HTML/JS/CSS) 및 백엔드 파일 생성 API 명세 정의
- 2 단계: 클라이언트 측 로컬 스토리지 기반 타이머 로직 및 '사용자 상호작용 후 시작' 구현
- 3 단계: Static Hosting (S3+CloudFront) 에 배포하여 백엔드 서버 의존성 없이 즉시 실행 검증
- 4 단계: Ollama 불안정 대비 SSE 스트림 및 세션 복원 로직 추가 구현 및 테스트
- 5 단계: 최종 MVP 배포 및 '첫 화면 즉시 시작' 요구사항 충족 확인
- node:test 기반 smoke test 파일을 만든다.

## 예시 코드
```js
import assert from "node:assert/strict";
import test from "node:test";

test("health endpoint returns ok", async () => {
  const response = await fetch("http://127.0.0.1:4040/api/health");
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
});
```