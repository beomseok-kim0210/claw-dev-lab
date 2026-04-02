import { generateAIFeaturesSpec, formatAIDiscussion, runAIDiscussion } from "../agents/aiAgent.js";
import { generateBackendSpec, formatBackendDiscussion, runBackendDiscussion } from "../agents/backendAgent.js";
import { generateFrontendSpec, formatFrontendDiscussion, runFrontendDiscussion } from "../agents/frontendAgent.js";
import { formatPmFinalDecision, formatPmInitialDiscussion, runPmFinalDecision, runPmInitialDiscussion } from "../agents/pmAgent.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import type {
  OrchestrationHooks,
  OrchestrationPhaseKey,
  OrchestrationResult,
} from "../types/orchestration.js";
import { ChatStateManager } from "./chatState.js";
import { writeExecutionArtifacts } from "./outputWriter.js";

type MultiAgentOrchestratorArgs = {
  client: OllamaClient;
  outputDir: string;
  hooks?: OrchestrationHooks;
};

export class MultiAgentOrchestrator {
  private readonly client: OllamaClient;
  private readonly outputDir: string;
  private readonly hooks: OrchestrationHooks | undefined;

  constructor(args: MultiAgentOrchestratorArgs) {
    this.client = args.client;
    this.outputDir = args.outputDir;
    this.hooks = args.hooks;
  }

  async run(userRequest: string): Promise<OrchestrationResult> {
    const chat = new ChatStateManager();
    const userMessage = chat.addUserRequest(userRequest);
    await this.emitMessage(userMessage);
    await this.emitPhase("user", "사용자 요청", "completed", "사용자가 공유 채팅방에 요청을 등록했습니다.");

    await this.emitPhase("pm-initial", "PM 문제 정의", "active", "PM 에이전트가 제품 문제와 MVP 범위를 정리하고 있습니다.");
    const pmInitial = await runPmInitialDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    const pmInitialMessage = chat.addAgentMessage("pm", formatPmInitialDiscussion(pmInitial));
    await this.emitMessage(pmInitialMessage);
    await this.emitPhase("pm-initial", "PM 문제 정의", "completed", "PM 에이전트가 초기 MVP 프레이밍을 확정했습니다.");

    await this.emitPhase("backend", "백엔드 검토", "active", "백엔드 에이전트가 API, 데이터 모델, 제약 사항을 제안하고 있습니다.");
    const backend = await runBackendDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    const backendMessage = chat.addAgentMessage("backend", formatBackendDiscussion(backend));
    await this.emitMessage(backendMessage);
    await this.emitPhase("backend", "백엔드 검토", "completed", "백엔드 에이전트가 기술 검토를 마쳤습니다.");

    await this.emitPhase("frontend", "프론트엔드 검토", "active", "프론트엔드 에이전트가 화면 구조와 사용성을 설계하고 있습니다.");
    const frontend = await runFrontendDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    const frontendMessage = chat.addAgentMessage("frontend", formatFrontendDiscussion(frontend));
    await this.emitMessage(frontendMessage);
    await this.emitPhase("frontend", "프론트엔드 검토", "completed", "프론트엔드 에이전트가 UI 검토를 마쳤습니다.");

    await this.emitPhase("ai", "AI 검토", "active", "AI 전문가가 기능, 실현 가능성, 위험 요소를 평가하고 있습니다.");
    const ai = await runAIDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    const aiMessage = chat.addAgentMessage("ai", formatAIDiscussion(ai));
    await this.emitMessage(aiMessage);
    await this.emitPhase("ai", "AI 검토", "completed", "AI 전문가가 AI 기능 검토를 마쳤습니다.");

    await this.emitPhase("pm-final", "PM 최종 결정", "active", "PM 에이전트가 논의를 종합해 최종 MVP 방향을 결정하고 있습니다.");
    const pmFinal = await runPmFinalDecision({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    const pmFinalMessage = chat.addAgentMessage("pm", formatPmFinalDecision(pmFinal));
    await this.emitMessage(pmFinalMessage);
    await this.emitPhase("pm-final", "PM 최종 결정", "completed", "PM 에이전트가 최종 MVP 방향을 확정했습니다.");

    await this.emitPhase("execution", "실행 산출물", "active", "백엔드, 프론트엔드, AI 구현 문서를 생성하고 있습니다.");
    const backendSpec = await generateBackendSpec({
      client: this.client,
      userRequest,
      finalDecision: pmFinal,
      backendDiscussion: backend,
    });

    const frontendSpec = await generateFrontendSpec({
      client: this.client,
      userRequest,
      finalDecision: pmFinal,
      frontendDiscussion: frontend,
    });

    const aiFeaturesSpec = await generateAIFeaturesSpec({
      client: this.client,
      userRequest,
      finalDecision: pmFinal,
      aiDiscussion: ai,
    });

    const artifacts = await writeExecutionArtifacts({
      outputDir: this.outputDir,
      finalDecision: pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
    });
    await this.hooks?.onArtifacts?.(artifacts);
    await this.emitPhase("execution", "실행 산출물", "completed", "구현 가능한 마크다운 산출물을 생성했습니다.");

    return {
      userRequest,
      transcript: chat.getMessages(),
      discussion: {
        pmInitial,
        backend,
        frontend,
        ai,
        pmFinal,
      },
      specs: {
        backend: backendSpec,
        frontend: frontendSpec,
        ai: aiFeaturesSpec,
      },
      artifacts,
    };
  }

  private async emitMessage(message: OrchestrationResult["transcript"][number]): Promise<void> {
    await this.hooks?.onMessage?.(message);
  }

  private async emitPhase(
    key: OrchestrationPhaseKey,
    label: string,
    state: "active" | "completed" | "failed",
    detail: string,
  ): Promise<void> {
    await this.hooks?.onPhase?.({
      key,
      label,
      state,
      detail,
      timestamp: new Date().toISOString(),
    });
  }
}
