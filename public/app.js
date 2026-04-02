const EXAMPLE_REQUEST =
  "사용자가 PRD를 올리면 PM이 먼저 문제를 정의하고, 백엔드·프론트엔드·AI·인프라가 자유 토론과 반박을 이어간 뒤 필요한 정보는 사용자에게 다시 묻고 설계와 코드 생성까지 이어가는 협업 워크스페이스를 만들어줘.";

const state = {
  sessionId: null,
  snapshot: null,
  eventSource: null,
  activeArtifact: null,
};

const requestInput = document.getElementById("requestInput");
const targetDirectoryInput = document.getElementById("targetDirectoryInput");
const submitButton = document.getElementById("submitButton");
const exampleButton = document.getElementById("exampleButton");
const sessionIdValue = document.getElementById("sessionIdValue");
const sessionStatusValue = document.getElementById("sessionStatusValue");
const targetDirectoryValue = document.getElementById("targetDirectoryValue");
const healthChip = document.getElementById("healthChip");
const modelChip = document.getElementById("modelChip");
const phaseList = document.getElementById("phaseList");
const clarificationPanel = document.getElementById("clarificationPanel");
const clarificationSummary = document.getElementById("clarificationSummary");
const clarificationForm = document.getElementById("clarificationForm");
const chatStream = document.getElementById("chatStream");
const decisionText = document.getElementById("decisionText");
const artifactToolbar = document.getElementById("artifactToolbar");
const artifactPreview = document.getElementById("artifactPreview");
const messageTemplate = document.getElementById("messageTemplate");

exampleButton.addEventListener("click", () => {
  requestInput.value = EXAMPLE_REQUEST;
});

submitButton.addEventListener("click", async () => {
  const request = requestInput.value.trim();
  if (request.length < 10) {
    requestInput.focus();
    requestInput.setSelectionRange(request.length, request.length);
    return;
  }

  setBusy(true);
  resetSessionView();

  try {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request,
        targetDirectory: targetDirectoryInput.value.trim() || undefined,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: "세션 시작에 실패했습니다." }));
      throw new Error(errorPayload.error ?? "세션 시작에 실패했습니다.");
    }

    const snapshot = await response.json();
    state.sessionId = snapshot.id;
    state.snapshot = snapshot;
    applySnapshot(snapshot);
    openSessionStream(snapshot.id);
  } catch (error) {
    setBusy(false);
    sessionStatusValue.textContent = error instanceof Error ? error.message : String(error);
  }
});

async function boot() {
  renderPhases([]);
  renderClarification(undefined, "queued");
  await loadHealth();
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();
    healthChip.textContent = payload.ok ? "Ollama 연결됨" : "Ollama 연결 실패";
    healthChip.classList.toggle("healthy", Boolean(payload.ok));
    modelChip.textContent = payload.model ?? "qwen3";
    if (!targetDirectoryInput.value && payload.defaultTargetDirectory) {
      targetDirectoryInput.value = payload.defaultTargetDirectory;
    }
  } catch {
    healthChip.textContent = "Ollama 연결 실패";
    healthChip.classList.remove("healthy");
  }
}

function openSessionStream(sessionId) {
  if (state.eventSource) {
    state.eventSource.close();
  }

  const eventSource = new EventSource(`/api/sessions/${sessionId}/events`);
  state.eventSource = eventSource;

  eventSource.addEventListener("snapshot", (event) => {
    const payload = JSON.parse(event.data);
    state.snapshot = payload.snapshot;
    applySnapshot(payload.snapshot);
  });

  eventSource.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    state.snapshot.transcript.push(payload.message);
    applySnapshot(state.snapshot);
  });

  eventSource.addEventListener("phase", (event) => {
    const payload = JSON.parse(event.data);
    const index = state.snapshot.phases.findIndex((phase) => phase.key === payload.phase.key);
    if (index >= 0) {
      state.snapshot.phases[index] = payload.phase;
    }
    applySnapshot(state.snapshot);
  });

  eventSource.addEventListener("artifacts", (event) => {
    const payload = JSON.parse(event.data);
    state.snapshot.artifacts = payload.artifacts;
    if (!state.activeArtifact && payload.artifacts.length > 0) {
      state.activeArtifact = payload.artifacts[0].filename;
    }
    applySnapshot(state.snapshot);
  });

  eventSource.addEventListener("clarification", (event) => {
    const payload = JSON.parse(event.data);
    state.snapshot.clarification = payload.clarification;
    applySnapshot(state.snapshot);
  });

  eventSource.addEventListener("status", (event) => {
    const payload = JSON.parse(event.data);
    state.snapshot.status = payload.status;
    if (payload.error) {
      state.snapshot.error = payload.error;
    }
    applySnapshot(state.snapshot);

    if (payload.status === "waiting_input") {
      setBusy(false);
      return;
    }

    if (payload.status === "completed" || payload.status === "failed") {
      setBusy(false);
      eventSource.close();
    }
  });

  eventSource.onerror = () => {
    if (!state.snapshot) {
      return;
    }
    if (state.snapshot.status !== "completed" && state.snapshot.status !== "failed") {
      sessionStatusValue.textContent = "연결이 끊어졌습니다. 새로고침 후 다시 접속하세요.";
    }
  };
}

function applySnapshot(snapshot) {
  sessionIdValue.textContent = snapshot.id;
  sessionStatusValue.textContent = formatStatus(snapshot.status, snapshot.error);
  targetDirectoryValue.textContent = snapshot.targetDirectory ?? "세션 출력 폴더 사용";
  renderPhases(snapshot.phases);
  renderClarification(snapshot.clarification, snapshot.status);
  renderTranscript(snapshot.transcript);
  renderDecision(snapshot.transcript, snapshot.error);
  renderArtifacts(snapshot.artifacts);
}

function formatStatus(status, error) {
  if (status === "failed" && error) {
    return `실패: ${error}`;
  }
  if (status === "queued") {
    return "대기 중";
  }
  if (status === "running") {
    return "실행 중";
  }
  if (status === "waiting_input") {
    return "사용자 답변 대기";
  }
  if (status === "completed") {
    return "완료";
  }
  return "대기 중";
}

function renderPhases(phases) {
  const items = phases.length > 0 ? phases : defaultPhases();
  phaseList.innerHTML = "";

  for (const phase of items) {
    const li = document.createElement("li");
    li.className = `phase-item state-${phase.state}`;

    const dot = document.createElement("span");
    dot.className = "phase-dot";

    const content = document.createElement("div");
    content.className = "phase-copy";

    const title = document.createElement("p");
    title.className = "phase-title";
    title.textContent = phase.label;

    const detail = document.createElement("p");
    detail.className = "phase-detail";
    detail.textContent = phase.detail || detailForState(phase.state);

    content.append(title, detail);
    li.append(dot, content);
    phaseList.append(li);
  }
}

function renderClarification(clarification, status) {
  clarificationForm.innerHTML = "";
  clarificationSummary.textContent = "";

  if (!clarification) {
    clarificationPanel.classList.add("hidden");
    return;
  }

  clarificationPanel.classList.remove("hidden");
  clarificationSummary.textContent = clarification.summary;

  if (clarification.state === "answered") {
    clarificationForm.innerHTML = clarification.questions
      .map((question) => {
        const matched = clarification.answers.find((answer) => answer.questionId === question.id);
        return `
          <div class="clarification-question">
            <div class="clarification-meta">${roleLabel(question.askedBy)} · ${topicLabel(question.topic)} · ${question.id}</div>
            <p class="clarification-text">${escapeHtml(question.question)}</p>
            <p class="clarification-reason">${escapeHtml(question.reason)}</p>
            <div class="clarification-answer">${escapeHtml(matched?.answer ?? "답변 없음")}</div>
          </div>
        `;
      })
      .join("");
    return;
  }

  clarificationForm.innerHTML = clarification.questions
    .map(
      (question) => `
        <label class="clarification-question" for="${question.id}">
          <span class="clarification-meta">${roleLabel(question.askedBy)} · ${topicLabel(question.topic)} · ${question.id}</span>
          <span class="clarification-text">${escapeHtml(question.question)}</span>
          <span class="clarification-reason">${escapeHtml(question.reason)}</span>
          <textarea class="clarification-input" id="${question.id}" data-question-id="${question.id}" placeholder="이 질문에 대한 답변을 입력하세요"></textarea>
        </label>
      `,
    )
    .join("");

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "primary-button clarification-submit";
  submit.textContent = status === "waiting_input" ? "답변 제출" : "답변 제출 대기";
  submit.disabled = status !== "waiting_input";
  submit.addEventListener("click", () => {
    void submitClarificationAnswers(clarification.questions);
  });
  clarificationForm.append(submit);
}

async function submitClarificationAnswers(questions) {
  if (!state.sessionId) {
    return;
  }

  const answers = questions.map((question) => {
    const field = clarificationForm.querySelector(`[data-question-id="${question.id}"]`);
    const value = field instanceof HTMLTextAreaElement ? field.value.trim() : "";
    return {
      questionId: question.id,
      answer: value.length > 0 ? value : "추가 정보 없이 기본 가정으로 진행합니다.",
    };
  });

  const submit = clarificationForm.querySelector(".clarification-submit");
  if (submit instanceof HTMLButtonElement) {
    submit.disabled = true;
    submit.textContent = "답변 전송 중...";
  }

  try {
    const response = await fetch(`/api/sessions/${state.sessionId}/clarifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answers }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "답변 제출에 실패했습니다." }));
      throw new Error(payload.error ?? "답변 제출에 실패했습니다.");
    }
  } catch (error) {
    if (submit instanceof HTMLButtonElement) {
      submit.disabled = false;
      submit.textContent = "답변 제출";
    }
    sessionStatusValue.textContent = error instanceof Error ? error.message : String(error);
  }
}

function renderTranscript(transcript) {
  chatStream.innerHTML = "";

  if (!transcript.length) {
    chatStream.innerHTML = `
      <div class="empty-state">
        <p class="empty-kicker">아직 대화가 없습니다</p>
        <h3>세션을 시작하면 주장, 반박, 보완, 구현 메시지가 순서대로 표시됩니다.</h3>
        <p>중간 토론은 고정 순서가 아니라 동적으로 진행되고, 구현 중에도 같은 채팅방에 메시지가 이어집니다.</p>
      </div>
    `;
    return;
  }

  const sorted = [...transcript].sort((left, right) => left.turn - right.turn);
  for (const message of sorted) {
    const fragment = messageTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".message-card");
    const role = fragment.querySelector(".message-role");
    const id = fragment.querySelector(".message-id");
    const speaker = fragment.querySelector(".message-speaker");
    const body = fragment.querySelector(".message-body");

    card.dataset.role = message.role;
    role.textContent = roleLabel(message.role);
    id.textContent = message.id;
    speaker.textContent = message.speaker;
    body.innerHTML = renderMessageBody(message.content);

    chatStream.append(fragment);
  }

  chatStream.scrollTop = chatStream.scrollHeight;
}

function renderMessageBody(content) {
  const lines = content.split("\n");
  const blocks = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length === 0) {
      return;
    }
    blocks.push(`<ul class="message-list">${listBuffer.join("")}</ul>`);
    listBuffer = [];
  };

  for (const line of lines) {
    if (line.trim().length === 0) {
      flushList();
      continue;
    }

    if (line.startsWith("- ")) {
      listBuffer.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }

    flushList();
    const matched = line.match(/^([^:]+):\s*(.*)$/);
    if (!matched) {
      blocks.push(`<p class="message-paragraph">${escapeHtml(line)}</p>`);
      continue;
    }

    const label = escapeHtml(matched[1] ?? "");
    const value = matched[2] ?? "";
    if (value.length === 0) {
      blocks.push(`<div class="message-section-title">${label}</div>`);
      continue;
    }

    if (matched[1] === "메시지 유형" || matched[1] === "반응 유형") {
      blocks.push(
        `<div class="message-line"><span class="line-label">${label}</span><span class="message-pill" data-kind="${reactionKind(value)}">${escapeHtml(value)}</span></div>`,
      );
      continue;
    }

    blocks.push(
      `<div class="message-line"><span class="line-label">${label}</span><span class="line-value">${escapeHtml(value)}</span></div>`,
    );
  }

  flushList();
  return blocks.join("");
}

function reactionKind(value) {
  if (value.includes("반박") || value.includes("challenge")) {
    return "challenge";
  }
  if (value.includes("지지") || value.includes("support")) {
    return "support";
  }
  return "refine";
}

function roleLabel(role) {
  if (role === "pm") {
    return "PM";
  }
  if (role === "backend") {
    return "백엔드";
  }
  if (role === "frontend") {
    return "프론트엔드";
  }
  if (role === "ai") {
    return "AI";
  }
  if (role === "infra") {
    return "인프라";
  }
  return "사용자";
}

function topicLabel(topic) {
  if (topic === "scope") {
    return "범위";
  }
  if (topic === "api") {
    return "API";
  }
  if (topic === "data") {
    return "데이터";
  }
  if (topic === "ui") {
    return "UI";
  }
  if (topic === "ai") {
    return "AI";
  }
  return "인프라";
}

function renderDecision(transcript, error) {
  if (error) {
    decisionText.textContent = error;
    return;
  }

  const pmMessages = transcript.filter((message) => message.role === "pm");
  const finalPm = pmMessages.at(-1);
  if (!finalPm) {
    decisionText.textContent = "토론이 끝나면 PM 최종 결정이 여기에 표시됩니다.";
    return;
  }

  const decisionLine = finalPm.content
    .split("\n")
    .find((line) => line.startsWith("최종 결정:") || line.startsWith("Final Decision:"));

  decisionText.textContent = decisionLine
    ? decisionLine.replace("최종 결정:", "").replace("Final Decision:", "").trim()
    : finalPm.content;
}

function renderArtifacts(artifacts) {
  artifactToolbar.innerHTML = "";

  if (!artifacts.length) {
    const failureMessage =
      state.snapshot?.status === "failed" && state.snapshot?.error
        ? `<p class="artifact-error">${escapeHtml(state.snapshot.error)}</p>`
        : "";

    artifactPreview.innerHTML = `
      <div class="empty-state compact">
        <h3>아직 생성된 파일이 없습니다</h3>
        <p>명세 문서, 구현 계획, 생성 코드가 이 영역에 표시됩니다.</p>
        ${failureMessage}
      </div>
    `;
    return;
  }

  if (!state.activeArtifact || !artifacts.some((artifact) => artifact.filename === state.activeArtifact)) {
    state.activeArtifact = artifacts[0].filename;
  }

  for (const artifact of artifacts) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `artifact-tab${artifact.filename === state.activeArtifact ? " active" : ""}`;
    button.textContent = artifact.filename;
    button.addEventListener("click", () => {
      state.activeArtifact = artifact.filename;
      renderArtifacts(artifacts);
    });
    artifactToolbar.append(button);
  }

  const activeArtifact = artifacts.find((artifact) => artifact.filename === state.activeArtifact) ?? artifacts[0];
  artifactPreview.innerHTML = `
    <div class="artifact-actions">
      <a class="download-link" href="${activeArtifact.url}" download="${activeArtifact.filename}">파일 다운로드</a>
    </div>
    ${renderArtifactContent(activeArtifact)}
  `;
}

function renderArtifactContent(artifact) {
  if (isMarkdownArtifact(artifact.filename)) {
    return `<div class="markdown-body">${renderMarkdown(artifact.content)}</div>`;
  }

  return `<pre class="code-block"><code>${escapeHtml(artifact.content)}</code></pre>`;
}

function isMarkdownArtifact(filename) {
  return filename.toLowerCase().endsWith(".md");
}

function renderMarkdown(markdown) {
  const escaped = escapeHtml(markdown);
  const blocks = [];
  const lines = escaped.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push(`<pre class="code-block"><code data-lang="${language}">${codeLines.join("\n")}</code></pre>`);
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(`<h1>${line.slice(2)}</h1>`);
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(`<h2>${line.slice(3)}</h2>`);
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(`<h3>${line.slice(4)}</h3>`);
      i += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(`<li>${lines[i].slice(2)}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (line.trim().length === 0) {
      i += 1;
      continue;
    }

    blocks.push(`<p>${line}</p>`);
    i += 1;
  }

  return blocks.join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setBusy(isBusy) {
  submitButton.disabled = isBusy;
  submitButton.textContent = isBusy ? "세션 실행 중..." : "세션 시작";
}

function resetSessionView() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }

  state.snapshot = null;
  state.activeArtifact = null;
  sessionIdValue.textContent = "시작 중...";
  sessionStatusValue.textContent = "대기 중";
  targetDirectoryValue.textContent = targetDirectoryInput.value.trim() || "세션 출력 폴더 사용";
  renderPhases(defaultPhases());
  renderClarification(undefined, "queued");
  renderTranscript([]);
  renderArtifacts([]);
  decisionText.textContent = "토론이 끝나면 PM 최종 결정이 여기에 표시됩니다.";
}

function defaultPhases() {
  return [
    { key: "user", label: "사용자 요청", state: "pending", detail: "요청을 기다리고 있습니다." },
    { key: "pm-initial", label: "PM 문제 정의", state: "pending", detail: "PM이 문제와 MVP를 정리합니다." },
    { key: "discussion", label: "자유 토론", state: "pending", detail: "역할별 주장과 반박이 오갑니다." },
    { key: "clarification", label: "추가 확인", state: "pending", detail: "필요하면 사용자에게 질문합니다." },
    { key: "pm-final", label: "PM 최종 결정", state: "pending", detail: "PM이 방향과 범위를 확정합니다." },
    { key: "execution", label: "명세 산출물", state: "pending", detail: "역할별 명세 문서를 생성합니다." },
    { key: "implementation", label: "구현 실행 계획", state: "pending", detail: "구현 순서와 완료 기준을 정리합니다." },
    { key: "coding", label: "코드 구현", state: "pending", detail: "실제 코드 생성과 상호 리뷰가 이어집니다." },
  ];
}

function detailForState(stateValue) {
  if (stateValue === "active") {
    return "현재 진행 중입니다.";
  }
  if (stateValue === "completed") {
    return "완료되었습니다.";
  }
  if (stateValue === "failed") {
    return "실패했습니다.";
  }
  return "대기 중입니다.";
}

boot();
