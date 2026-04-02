import { generateAIFeaturesSpec, formatAIDiscussion, runAIDiscussion } from "../agents/aiAgent.js";
import { generateBackendSpec, formatBackendDiscussion, runBackendDiscussion } from "../agents/backendAgent.js";
import { generateFrontendSpec, formatFrontendDiscussion, runFrontendDiscussion } from "../agents/frontendAgent.js";
import { generateImplementationPlan } from "../agents/implementationPlanner.js";
import { formatPmFinalDecision, formatPmInitialDiscussion, runPmFinalDecision, runPmInitialDiscussion } from "../agents/pmAgent.js";
import { formatAgentReaction, runAgentReaction } from "../agents/reactionAgent.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import type { AgentRole } from "../types/chat.js";
import type {
  AIDiscussion,
  BackendDiscussion,
  FrontendDiscussion,
} from "../types/contracts.js";
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

type DiscussionRole = Exclude<AgentRole, "pm">;

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

    await this.emitPhase("pm-initial", "PM 문제 정의", "active", "PM 에이전트가 토론의 기준선과 MVP 문제를 정리하고 있습니다.");
    const pmInitial = await runPmInitialDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    const pmInitialMessage = chat.addAgentMessage("pm", formatPmInitialDiscussion(pmInitial));
    await this.emitMessage(pmInitialMessage);
    await this.emitPhase("pm-initial", "PM 문제 정의", "completed", "PM 에이전트가 초기 문제 정의와 MVP 기준을 고정했습니다.");

    await this.emitPhase("discussion", "자유 토론", "active", "백엔드, 프론트엔드, AI 에이전트가 주장과 반박을 주고받고 있습니다.");
    const discussionOrder = this.buildDiscussionOrder(userRequest);

    let backend!: BackendDiscussion;
    let frontend!: FrontendDiscussion;
    let ai!: AIDiscussion;

    for (const role of discussionOrder) {
      if (role === "backend") {
        backend = await runBackendDiscussion({
          client: this.client,
          userRequest,
          messages: chat.getMessages(),
        });
        await this.emitMessage(chat.addAgentMessage("backend", formatBackendDiscussion(backend)));
        continue;
      }

      if (role === "frontend") {
        frontend = await runFrontendDiscussion({
          client: this.client,
          userRequest,
          messages: chat.getMessages(),
        });
        await this.emitMessage(chat.addAgentMessage("frontend", formatFrontendDiscussion(frontend)));
        continue;
      }

      ai = await runAIDiscussion({
        client: this.client,
        userRequest,
        messages: chat.getMessages(),
      });
      await this.emitMessage(chat.addAgentMessage("ai", formatAIDiscussion(ai)));
    }

    const reactionOrder = this.rotateRoles(discussionOrder, 1);
    const reactions = [];
    for (const role of reactionOrder) {
      const targetMessage = this.pickReactionTarget(role, chat.getMessages());
      const reaction = await runAgentReaction({
        client: this.client,
        role,
        userRequest,
        messages: chat.getMessages(),
        targetMessage,
      });
      reactions.push(reaction);
      await this.emitMessage(chat.addAgentMessage(role, formatAgentReaction(reaction)));
    }
    await this.emitPhase("discussion", "자유 토론", "completed", "중간 자유 토론이 끝났고 각 역할의 주장과 반박이 정리되었습니다.");

    await this.emitPhase("pm-final", "PM 최종 결정", "active", "PM 에이전트가 토론을 정리하고 최종 MVP 방향을 결정하고 있습니다.");
    const pmFinal = await runPmFinalDecision({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    const pmFinalMessage = chat.addAgentMessage("pm", formatPmFinalDecision(pmFinal));
    await this.emitMessage(pmFinalMessage);
    await this.emitPhase("pm-final", "PM 최종 결정", "completed", "PM 에이전트가 최종 MVP 방향을 확정했습니다.");

    await this.emitPhase("execution", "명세 산출물", "active", "역할별 구현 명세 문서를 생성하고 있습니다.");
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
    await this.emitPhase("execution", "명세 산출물", "completed", "백엔드, 프론트엔드, AI 명세 문서를 생성했습니다.");

    await this.emitPhase("implementation", "구현 실행 계획", "active", "설계 결과를 실제 구현 작업 단위로 분해하고 있습니다.");
    const implementationPlan = await generateImplementationPlan({
      client: this.client,
      userRequest,
      finalDecision: pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
    });

    const artifacts = await writeExecutionArtifacts({
      outputDir: this.outputDir,
      finalDecision: pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      implementationPlan,
    });
    await this.hooks?.onArtifacts?.(artifacts);
    await this.emitPhase("implementation", "구현 실행 계획", "completed", "실제 구현 순서와 완료 기준이 담긴 계획까지 생성했습니다.");

    return {
      userRequest,
      transcript: chat.getMessages(),
      discussion: {
        pmInitial,
        backend,
        frontend,
        ai,
        reactions,
        pmFinal,
      },
      specs: {
        backend: backendSpec,
        frontend: frontendSpec,
        ai: aiFeaturesSpec,
        implementation: implementationPlan,
      },
      artifacts,
    };
  }

  private buildDiscussionOrder(userRequest: string): DiscussionRole[] {
    const roles: DiscussionRole[] = ["backend", "frontend", "ai"];
    const hash = Array.from(userRequest).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.rotateRoles(roles, hash % roles.length);
  }

  private rotateRoles<T>(items: T[], offset: number): T[] {
    if (items.length === 0) {
      return [];
    }
    const normalized = ((offset % items.length) + items.length) % items.length;
    return [...items.slice(normalized), ...items.slice(0, normalized)];
  }

  private pickReactionTarget(role: DiscussionRole, messages: OrchestrationResult["transcript"]): OrchestrationResult["transcript"][number] {
    const reversed = [...messages].reverse();
    const target = reversed.find((message) => message.role !== "user" && message.role !== role);
    if (!target) {
      throw new Error(`반응 대상 메시지를 찾지 못했습니다: ${role}`);
    }
    return target;
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
