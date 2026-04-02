import { formatAIDiscussion, generateAIFeaturesSpec, runAIDiscussion } from "../agents/aiAgent.js";
import { formatBackendDiscussion, generateBackendSpec, runBackendDiscussion } from "../agents/backendAgent.js";
import {
  formatClarificationAnswerMessage,
  formatClarificationQuestionMessage,
  planClarification,
} from "../agents/clarificationAgent.js";
import { buildCodeArtifacts } from "../agents/codeScaffolder.js";
import {
  formatImplementationReview,
  formatImplementationUpdate,
  runImplementationReview,
  runImplementationUpdate,
} from "../agents/codingAgent.js";
import { formatFrontendDiscussion, generateFrontendSpec, runFrontendDiscussion } from "../agents/frontendAgent.js";
import { formatInfraDiscussion, generateInfraSpec, runInfraDiscussion } from "../agents/infraAgent.js";
import { generateImplementationPlan } from "../agents/implementationPlanner.js";
import {
  formatPmFinalDecision,
  formatPmInitialDiscussion,
  runPmFinalDecision,
  runPmInitialDiscussion,
} from "../agents/pmAgent.js";
import { formatAgentReaction, runAgentReaction } from "../agents/reactionAgent.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import type { AgentRole, ChatMessage } from "../types/chat.js";
import type {
  AIDiscussion,
  BackendDiscussion,
  FrontendDiscussion,
  ImplementationPlan,
  InfraDiscussion,
} from "../types/contracts.js";
import type {
  ClarificationAnswer,
  ClarificationExchange,
  GeneratedArtifact,
  OrchestrationHooks,
  OrchestrationPhaseKey,
  OrchestrationResult,
} from "../types/orchestration.js";
import { ChatStateManager } from "./chatState.js";
import { writeArtifacts, writeExecutionArtifacts } from "./outputWriter.js";

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
    await this.emitPhase("user", "사용자 요청", "completed", "공유 채팅방에 새로운 요청이 등록되었습니다.");

    await this.emitPhase("pm-initial", "PM 문제 정의", "active", "PM이 문제 정의와 MVP 범위를 정리하고 있습니다.");
    const pmInitial = await runPmInitialDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    await this.emitMessage(chat.addAgentMessage("pm", formatPmInitialDiscussion(pmInitial)));
    await this.emitPhase("pm-initial", "PM 문제 정의", "completed", "PM이 초기 목표와 성공 기준을 정리했습니다.");

    await this.emitPhase("discussion", "자유 토론", "active", "백엔드, 프론트엔드, AI, 인프라가 순서를 바꿔가며 주장과 반박을 남기고 있습니다.");
    const discussionOrder = this.buildDiscussionOrder(userRequest);

    let backend: BackendDiscussion | undefined;
    let frontend: FrontendDiscussion | undefined;
    let ai: AIDiscussion | undefined;
    let infra: InfraDiscussion | undefined;

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

      if (role === "infra") {
        infra = await runInfraDiscussion({
          client: this.client,
          userRequest,
          messages: chat.getMessages(),
        });
        await this.emitMessage(chat.addAgentMessage("infra", formatInfraDiscussion(infra)));
        continue;
      }

      ai = await runAIDiscussion({
        client: this.client,
        userRequest,
        messages: chat.getMessages(),
      });
      await this.emitMessage(chat.addAgentMessage("ai", formatAIDiscussion(ai)));
    }

    if (!backend || !frontend || !ai || !infra) {
      throw new Error("중간 토론이 완결되지 않았습니다.");
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
    await this.emitPhase("discussion", "자유 토론", "completed", "중간 토론이 끝났고, 역할별 주장과 반박이 정리되었습니다.");

    await this.emitPhase("clarification", "추가 확인", "active", "구현 전 사용자 확인이 필요한 항목이 있는지 점검하고 있습니다.");
    const clarification = await this.handleClarification(userRequest, chat);
    await this.emitPhase(
      "clarification",
      "추가 확인",
      "completed",
      clarification
        ? "사용자 답변을 반영해 모호한 항목을 정리했습니다."
        : "추가 질문 없이 현재 정보로 진행해도 된다고 판단했습니다.",
    );

    await this.emitPhase("pm-final", "PM 최종 결정", "active", "PM이 전체 토론과 확인 내용을 종합해 최종 방향을 확정하고 있습니다.");
    const pmFinal = await runPmFinalDecision({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    await this.emitMessage(chat.addAgentMessage("pm", formatPmFinalDecision(pmFinal)));
    await this.emitPhase("pm-final", "PM 최종 결정", "completed", "PM이 최종 MVP 방향을 확정했습니다.");

    await this.emitPhase("execution", "명세 산출물", "active", "역할별 구현 명세를 생성하고 있습니다.");
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
    const infraSpec = await generateInfraSpec({
      client: this.client,
      userRequest,
      finalDecision: pmFinal,
      infraDiscussion: infra,
    });

    const implementationPlan = await this.generateImplementationPlanAndEmitPhase(
      userRequest,
      pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      infraSpec,
    );

    let artifacts = await writeExecutionArtifacts({
      outputDir: this.outputDir,
      finalDecision: pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      infraSpec,
      implementationPlan,
    });
    await this.hooks?.onArtifacts?.(artifacts);
    await this.emitPhase("execution", "명세 산출물", "completed", "역할별 명세 문서를 생성했습니다.");
    await this.emitPhase("implementation", "구현 실행 계획", "completed", "구현 순서와 완료 기준을 정리했습니다.");

    await this.emitPhase("coding", "코드 구현", "active", "에이전트가 실제 코드 파일을 생성하고, 이어서 상호 리뷰를 남기고 있습니다.");
    await this.emitMessage(chat.addAgentMessage("pm", formatCodingKickoffMessage(implementationPlan)));

    const codingTaskMap = new Map(
      implementationPlan.tasks
        .filter((task) => task.owner !== "pm")
        .map((task) => [task.owner, task] as const),
    );
    const codingOrder = discussionOrder.filter((role) => codingTaskMap.has(role));

    for (let index = 0; index < codingOrder.length; index += 1) {
      const owner = codingOrder[index];
      const task = owner ? codingTaskMap.get(owner) : undefined;
      if (!owner || !task) {
        continue;
      }

      const pendingFiles = buildCodeArtifacts({
        owner,
        userRequest,
        finalDecision: pmFinal,
        backendSpec,
        frontendSpec,
        aiFeaturesSpec,
        infraSpec,
      });
      const targetFiles = pendingFiles.map((file) => file.filename);

      const update = await runImplementationUpdate({
        client: this.client,
        role: owner,
        userRequest,
        messages: chat.getMessages(),
        task,
        targetFiles,
        backendSpec,
        frontendSpec,
        aiFeaturesSpec,
        infraSpec,
      });
      const updateMessage = chat.addAgentMessage(owner, formatImplementationUpdate(update));
      await this.emitMessage(updateMessage);

      const writtenCodeArtifacts = await writeArtifacts(
        this.outputDir,
        pendingFiles.map((file) => ({
          filename: file.filename,
          content: file.content,
        })),
      );
      artifacts = mergeArtifacts(artifacts, writtenCodeArtifacts);
      await this.hooks?.onArtifacts?.(artifacts);

      const reviewer = codingOrder.length > 1 ? codingOrder[(index + 1) % codingOrder.length] : undefined;
      if (reviewer && reviewer !== owner) {
        const review = await runImplementationReview({
          client: this.client,
          role: reviewer,
          userRequest,
          messages: chat.getMessages(),
          targetMessage: updateMessage,
          targetFiles,
        });
        await this.emitMessage(chat.addAgentMessage(reviewer, formatImplementationReview(review)));
      }
    }

    const codeArtifacts = artifacts.filter((artifact) => artifact.filename.startsWith("generated-app/"));
    await this.emitMessage(chat.addAgentMessage("pm", formatCodingWrapUpMessage(codeArtifacts)));
    await this.emitPhase("coding", "코드 구현", "completed", "역할별 코드 생성과 상호 리뷰가 마무리되었습니다.");

    return {
      userRequest,
      transcript: chat.getMessages(),
      discussion: {
        pmInitial,
        backend,
        frontend,
        ai,
        infra,
        reactions,
        ...(clarification ? { clarification } : {}),
        pmFinal,
      },
      specs: {
        backend: backendSpec,
        frontend: frontendSpec,
        ai: aiFeaturesSpec,
        infra: infraSpec,
        implementation: implementationPlan,
      },
      artifacts,
    };
  }

  private async handleClarification(
    userRequest: string,
    chat: ChatStateManager,
  ): Promise<ClarificationExchange | undefined> {
    const plan = await planClarification({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });

    if (!plan.needsInput || plan.questions.length === 0) {
      return undefined;
    }

    await this.emitMessage(chat.addAgentMessage("pm", formatClarificationQuestionMessage(plan)));

    let answers: ClarificationAnswer[] = [];
    if (this.hooks?.onClarificationRequest) {
      answers = await this.hooks.onClarificationRequest(plan);
    }

    if (answers.length > 0) {
      await this.emitMessage(chat.addUserMessage(formatClarificationAnswerMessage(answers)));
    }

    return {
      summary: plan.summary,
      questions: plan.questions,
      answers,
    };
  }

  private async generateImplementationPlanAndEmitPhase(
    userRequest: string,
    finalDecision: OrchestrationResult["discussion"]["pmFinal"],
    backendSpec: OrchestrationResult["specs"]["backend"],
    frontendSpec: OrchestrationResult["specs"]["frontend"],
    aiFeaturesSpec: OrchestrationResult["specs"]["ai"],
    infraSpec: OrchestrationResult["specs"]["infra"],
  ): Promise<ImplementationPlan> {
    await this.emitPhase("implementation", "구현 실행 계획", "active", "명세를 실제 구현 작업 단위로 나누고 있습니다.");
    return generateImplementationPlan({
      client: this.client,
      userRequest,
      finalDecision,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      infraSpec,
    });
  }

  private buildDiscussionOrder(userRequest: string): DiscussionRole[] {
    const roles: DiscussionRole[] = ["backend", "frontend", "ai", "infra"];
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

  private pickReactionTarget(role: DiscussionRole, messages: ChatMessage[]): ChatMessage {
    const reversed = [...messages].reverse();
    const target = reversed.find((message) => message.role !== "user" && message.role !== role);
    if (!target) {
      throw new Error(`반응할 대상 메시지를 찾지 못했습니다: ${role}`);
    }
    return target;
  }

  private async emitMessage(message: ChatMessage): Promise<void> {
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

function formatCodingKickoffMessage(plan: ImplementationPlan): string {
  return [
    "제목: 구현 단계 시작",
    `구현 목표: ${plan.overview}`,
    "작업 순서:",
    ...plan.tasks.map((task) => `- ${task.id} / ${task.owner} / ${task.title}`),
    "진행 방식:",
    "- 각 역할은 자신이 맡은 파일을 생성합니다.",
    "- 파일 생성 직후 다른 역할이 코드 리뷰 메시지를 남깁니다.",
    "- 문서와 코드 산출물이 같은 세션에서 함께 갱신됩니다.",
  ].join("\n");
}

function formatCodingWrapUpMessage(codeArtifacts: GeneratedArtifact[]): string {
  return [
    "제목: 코드 구현 마무리",
    `구현 결과: 총 ${codeArtifacts.length}개의 코드 파일을 생성했습니다.`,
    "생성 파일:",
    ...codeArtifacts.map((artifact) => `- ${artifact.filename}`),
    "다음 단계:",
    "- 생성된 파일을 기준으로 실제 저장소 연결이나 세부 기능 확장을 이어갈 수 있습니다.",
    "- 필요하면 테스트 러너와 실제 리포지토리 수정 단계를 추가할 수 있습니다.",
  ].join("\n");
}

function mergeArtifacts(existing: GeneratedArtifact[], next: GeneratedArtifact[]): GeneratedArtifact[] {
  const merged = new Map<string, GeneratedArtifact>();

  for (const artifact of existing) {
    merged.set(artifact.filename, artifact);
  }
  for (const artifact of next) {
    merged.set(artifact.filename, artifact);
  }

  return [...merged.values()];
}
