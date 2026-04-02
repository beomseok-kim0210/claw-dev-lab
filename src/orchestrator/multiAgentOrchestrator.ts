import { generateAIFeaturesSpec, formatAIDiscussion, runAIDiscussion } from "../agents/aiAgent.js";
import { generateBackendSpec, formatBackendDiscussion, runBackendDiscussion } from "../agents/backendAgent.js";
import { buildCodeArtifacts } from "../agents/codeScaffolder.js";
import {
  formatImplementationReview,
  formatImplementationUpdate,
  runImplementationReview,
  runImplementationUpdate,
} from "../agents/codingAgent.js";
import { generateFrontendSpec, formatFrontendDiscussion, runFrontendDiscussion } from "../agents/frontendAgent.js";
import { generateImplementationPlan } from "../agents/implementationPlanner.js";
import {
  formatPmFinalDecision,
  formatPmInitialDiscussion,
  runPmFinalDecision,
  runPmInitialDiscussion,
} from "../agents/pmAgent.js";
import { formatAgentReaction, runAgentReaction } from "../agents/reactionAgent.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import type { AgentRole } from "../types/chat.js";
import type {
  AIDiscussion,
  BackendDiscussion,
  FrontendDiscussion,
  ImplementationPlan,
} from "../types/contracts.js";
import type {
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
    await this.emitPhase("user", "사용자 요청", "completed", "사용자가 공유 채팅방에 요청을 등록했습니다.");

    await this.emitPhase("pm-initial", "PM 문제 정의", "active", "PM이 문제 정의와 MVP 기준을 고정하고 있습니다.");
    const pmInitial = await runPmInitialDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    await this.emitMessage(chat.addAgentMessage("pm", formatPmInitialDiscussion(pmInitial)));
    await this.emitPhase("pm-initial", "PM 문제 정의", "completed", "PM이 초기 문제 정의와 MVP 목표를 정리했습니다.");

    await this.emitPhase("discussion", "자유 토론", "active", "백엔드, 프론트엔드, AI가 주장과 반박을 주고받고 있습니다.");
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

    await this.emitPhase("pm-final", "PM 최종 결정", "active", "PM이 토론을 정리하고 최종 MVP 방향을 결정하고 있습니다.");
    const pmFinal = await runPmFinalDecision({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    await this.emitMessage(chat.addAgentMessage("pm", formatPmFinalDecision(pmFinal)));
    await this.emitPhase("pm-final", "PM 최종 결정", "completed", "PM이 최종 MVP 방향을 확정했습니다.");

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

    const implementationPlan = await this.generateImplementationPlanAndEmitPhase(
      userRequest,
      pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
    );

    let artifacts = await writeExecutionArtifacts({
      outputDir: this.outputDir,
      finalDecision: pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      implementationPlan,
    });
    await this.hooks?.onArtifacts?.(artifacts);
    await this.emitPhase("execution", "명세 산출물", "completed", "백엔드, 프론트엔드, AI 명세 문서를 생성했습니다.");
    await this.emitPhase("implementation", "구현 실행 계획", "completed", "구현 실행 계획을 정리했습니다.");

    await this.emitPhase("coding", "코드 구현", "active", "에이전트가 실제 코드 파일을 만들고 구현 리뷰를 이어가고 있습니다.");
    await this.emitMessage(chat.addAgentMessage("pm", formatCodingKickoffMessage(implementationPlan)));

    const codingTaskMap = new Map(
      implementationPlan.tasks
        .filter((task) => task.owner !== "pm")
        .map((task) => [task.owner, task] as const),
    );
    const codingOrder = discussionOrder.filter((role) => codingTaskMap.has(role));

    for (let index = 0; index < codingOrder.length; index += 1) {
      const owner = codingOrder[index];
      if (!owner) {
        continue;
      }
      const task = codingTaskMap.get(owner);
      if (!task) {
        continue;
      }

      const pendingFiles = buildCodeArtifacts({
        owner,
        userRequest,
        finalDecision: pmFinal,
        backendSpec,
        frontendSpec,
        aiFeaturesSpec,
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
      });
      const updateMessage = chat.addAgentMessage(owner, formatImplementationUpdate(update));
      await this.emitMessage(updateMessage);

      const writtenCodeArtifacts = await writeArtifacts(
        this.outputDir,
        pendingFiles.map((file) => ({ filename: file.filename, content: file.content })),
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
    await this.emitPhase("coding", "코드 구현", "completed", "역할별 코드 생성과 구현 리뷰가 끝났습니다.");

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

  private async generateImplementationPlanAndEmitPhase(
    userRequest: string,
    finalDecision: OrchestrationResult["discussion"]["pmFinal"],
    backendSpec: OrchestrationResult["specs"]["backend"],
    frontendSpec: OrchestrationResult["specs"]["frontend"],
    aiFeaturesSpec: OrchestrationResult["specs"]["ai"],
  ): Promise<ImplementationPlan> {
    await this.emitPhase("implementation", "구현 실행 계획", "active", "명세를 실제 구현 작업 단위로 분해하고 있습니다.");
    return generateImplementationPlan({
      client: this.client,
      userRequest,
      finalDecision,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
    });
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

function formatCodingKickoffMessage(plan: ImplementationPlan): string {
  return [
    "제목: 구현 단계 시작",
    `구현 목표: ${plan.overview}`,
    "작업 순서:",
    ...plan.tasks.map((task) => `- ${task.id} / ${task.owner} / ${task.title}`),
    "진행 방식:",
    "- 각 역할이 담당 파일을 생성한다.",
    "- 생성 직후 다른 역할이 코드 리뷰 메시지를 남긴다.",
    "- 산출물 탭에서 문서와 코드 파일을 함께 확인할 수 있다.",
  ].join("\n");
}

function formatCodingWrapUpMessage(codeArtifacts: GeneratedArtifact[]): string {
  return [
    "제목: 코드 구현 마무리",
    `구현 결과: 총 ${codeArtifacts.length}개의 코드 파일이 생성되었다.`,
    "생성 파일:",
    ...codeArtifacts.map((artifact) => `- ${artifact.filename}`),
    "다음 단계:",
    "- 생성된 코드 파일을 기준으로 실제 저장소 연결이나 후속 수정 작업을 이어간다.",
    "- 필요하면 테스트 러너와 실제 코드베이스 쓰기 단계를 추가한다.",
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
