import { mkdir, readFile } from "node:fs/promises";
import { formatAIDiscussion, generateAIFeaturesSpec, runAIDiscussion } from "../agents/aiAgent.js";
import { formatBackendDiscussion, generateBackendSpec, runBackendDiscussion } from "../agents/backendAgent.js";
import {
  formatClarificationAnswerMessage,
  formatClarificationQuestionMessage,
  planClarification,
} from "../agents/clarificationAgent.js";
import { generateBuildBrief } from "../agents/buildBriefAgent.js";
import { isAllowedRolePath } from "../agents/codegenPaths.js";
import { generateCodeBundle, reviseCodeBundle } from "../agents/codegenAgent.js";
import {
  buildVerificationRepairReview,
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
import { formatTestDiscussion, generateTestSpec, runTestDiscussion } from "../agents/testAgent.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import type { AgentRole, ChatMessage } from "../types/chat.js";
import type {
  AIDiscussion,
  BackendDiscussion,
  FrontendDiscussion,
  ImplementationPlan,
  ImplementationReview,
  InfraDiscussion,
  TestDiscussion,
} from "../types/contracts.js";
import type {
  ClarificationAnswer,
  ClarificationExchange,
  CodeActivityUpdate,
  GeneratedArtifact,
  OrchestrationHooks,
  OrchestrationPhaseKey,
  OrchestrationResult,
  ProjectStartMode,
  VerificationCheck,
} from "../types/orchestration.js";
import type { BuildBrief } from "../types/generation.js";
import { ChatStateManager } from "./chatState.js";
import { writeArtifacts, writeExecutionArtifacts } from "./outputWriter.js";
import path from "node:path";
import {
  formatProjectMemoryMessage,
  formatRoleProjectMemoryMessage,
  listWorkspaceFiles,
  loadProjectMemory,
  loadWorkspaceContextFiles,
  persistProjectMemory,
  type ProjectMemory,
} from "./projectMemory.js";
import { formatVerificationReport, runWorkspaceVerification } from "./workspaceVerifier.js";

type MultiAgentOrchestratorArgs = {
  /** 토론·추론·리뷰 담당 모델 (qwen3.5 등 reasoning 특화) */
  client: OllamaClient;
  /** 코드 생성·수정 전용 모델 (qwen2.5-coder 등 코드 특화). 미설정 시 client와 동일 */
  codegenClient?: OllamaClient;
  outputDir: string;
  codeOutputDir?: string;
  codePathPrefix?: string;
  projectStartMode?: ProjectStartMode;
  hooks?: OrchestrationHooks;
};

type DiscussionRole = Exclude<AgentRole, "pm">;
const MAX_CODE_REVIEW_ROUNDS = 2;
const MAX_AUTONOMOUS_REPAIR_CYCLES = 3;

type GeneratedSpecBundle = {
  backend: OrchestrationResult["specs"]["backend"];
  frontend: OrchestrationResult["specs"]["frontend"];
  ai: OrchestrationResult["specs"]["ai"];
  infra: OrchestrationResult["specs"]["infra"];
  test: OrchestrationResult["specs"]["test"];
};

export class MultiAgentOrchestrator {
  private readonly client: OllamaClient;
  private readonly codegenClient: OllamaClient;
  private readonly outputDir: string;
  private readonly codeOutputDir: string;
  private readonly codePathPrefix: string;
  private readonly projectRootDir: string;
  private readonly projectStartMode: ProjectStartMode;
  private readonly hooks: OrchestrationHooks | undefined;

  constructor(args: MultiAgentOrchestratorArgs) {
    this.client = args.client;
    this.codegenClient = args.codegenClient ?? args.client;
    this.outputDir = args.outputDir;
    this.codeOutputDir = args.codeOutputDir ?? args.outputDir;
    this.codePathPrefix = args.codePathPrefix ?? (args.codeOutputDir ? "" : "generated-app");
    this.projectRootDir = this.codePathPrefix ? path.resolve(this.codeOutputDir, this.codePathPrefix) : this.codeOutputDir;
    this.projectStartMode = args.projectStartMode ?? "continue";
    this.hooks = args.hooks;
  }

  async run(userRequest: string): Promise<OrchestrationResult> {
    const chat = new ChatStateManager();
    await mkdir(this.projectRootDir, { recursive: true });
    const projectMemory =
      this.projectStartMode === "continue" ? await loadProjectMemory(this.projectRootDir) : undefined;
    let workspaceFiles =
      this.projectStartMode === "continue"
        ? await listWorkspaceFiles(this.projectRootDir).catch(() => [] as string[])
        : [];
    const userMessage = chat.addUserRequest(userRequest);
    await this.emitMessage(userMessage);
    await this.emitPhase("user", "사용자 요청", "completed", "공유 채팅방에 새로운 요청이 등록되었습니다.");

    await this.emitPhase("pm-initial", "PM 문제 정의", "active", "PM이 문제 정의와 MVP 범위를 정리하고 있습니다.");
    if (projectMemory) {
      await this.emitMessage(chat.addAgentMessage("pm", formatProjectMemoryMessage(projectMemory)));
    }

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
    let test: TestDiscussion | undefined;

    for (const role of discussionOrder) {
      const scopedMessages = this.buildRoleScopedMessages(chat, role, projectMemory);
      if (role === "backend") {
        backend = await runBackendDiscussion({
          client: this.client,
          userRequest,
          messages: scopedMessages,
        });
        await this.emitMessage(chat.addAgentMessage("backend", formatBackendDiscussion(backend)));
        continue;
      }

      if (role === "frontend") {
        frontend = await runFrontendDiscussion({
          client: this.client,
          userRequest,
          messages: scopedMessages,
        });
        await this.emitMessage(chat.addAgentMessage("frontend", formatFrontendDiscussion(frontend)));
        continue;
      }

      if (role === "infra") {
        infra = await runInfraDiscussion({
          client: this.client,
          userRequest,
          messages: scopedMessages,
        });
        await this.emitMessage(chat.addAgentMessage("infra", formatInfraDiscussion(infra)));
        continue;
      }

      if (role === "test") {
        test = await runTestDiscussion({
          client: this.client,
          userRequest,
          messages: scopedMessages,
        });
        await this.emitMessage(chat.addAgentMessage("test", formatTestDiscussion(test)));
        continue;
      }

      ai = await runAIDiscussion({
        client: this.client,
        userRequest,
        messages: scopedMessages,
      });
      await this.emitMessage(chat.addAgentMessage("ai", formatAIDiscussion(ai)));
    }

    if (!backend || !frontend || !ai || !infra || !test) {
      throw new Error("중간 토론이 완결되지 않았습니다.");
    }

    const reactionOrder = this.rotateRoles(discussionOrder, 1);
    const reactions = [];
    for (const role of reactionOrder) {
      const targetMessage = this.pickReactionTarget(role, chat.getMessages());
      const scopedMessages = this.buildRoleScopedMessages(chat, role, projectMemory);
      const reaction = await runAgentReaction({
        client: this.client,
        role,
        userRequest,
        messages: scopedMessages,
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
    const { backend: backendSpec, frontend: frontendSpec, ai: aiFeaturesSpec, infra: infraSpec, test: testSpec } =
      await this.generateSpecsInParallel({
        userRequest,
        finalDecision: pmFinal,
        backend,
        frontend,
        ai,
        infra,
        test,
      });

    const implementationPlan = await this.generateImplementationPlanAndEmitPhase(
      userRequest,
      pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      infraSpec,
      testSpec,
    );
    const buildBrief = await generateBuildBrief({
      client: this.client,
      userRequest,
      finalDecision: pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      infraSpec,
      testSpec,
      implementationPlan,
    });

    let artifacts = await writeExecutionArtifacts({
      outputDir: this.outputDir,
      finalDecision: pmFinal,
      backendSpec,
      frontendSpec,
      aiFeaturesSpec,
      infraSpec,
      testSpec,
      implementationPlan,
      buildBrief,
    });
    await this.hooks?.onArtifacts?.(artifacts);
    await this.emitPhase("execution", "명세 산출물", "completed", "역할별 명세 문서를 생성했습니다.");
    await this.emitPhase("implementation", "구현 실행 계획", "completed", "구현 순서와 완료 기준을 정리했습니다.");

    await this.emitPhase("coding", "코드 구현", "active", "에이전트가 실제 코드 파일을 생성하고, 이어서 상호 리뷰를 남기고 있습니다.");
    await this.emitMessage(
      chat.addAgentMessage("pm", formatCodingKickoffMessage(buildBrief, implementationPlan, this.codeOutputDir)),
    );

    const codingTaskMap = new Map(
      implementationPlan.tasks
        .filter((task) => task.owner !== "pm")
        .map((task) => [task.owner, task] as const),
    );
    const codingOrder = discussionOrder.filter((role) => codingTaskMap.has(role));
    let codeArtifacts: GeneratedArtifact[] = [];
    const unresolvedReviewFindings: string[] = [];

    for (let index = 0; index < codingOrder.length; index += 1) {
      const owner = codingOrder[index];
      const task = owner ? codingTaskMap.get(owner) : undefined;
      if (!owner || !task) {
        continue;
      }

      const existingFiles = uniqueCodePaths([
        ...workspaceFiles,
        ...artifacts
          .map((artifact) => stripCodePrefix(artifact.filename, this.codePathPrefix))
          .filter((filename) => filename.length > 0 && !filename.endsWith(".md")),
      ]);
      const workspaceContextFiles = await this.loadRoleWorkspaceContextFiles(owner, workspaceFiles);
      const ownerMessages = this.buildRoleScopedMessages(chat, owner, projectMemory);
      const bundle = await generateCodeBundle({
        client: this.codegenClient,
        role: owner,
        userRequest,
        messages: ownerMessages,
        buildBrief,
        task,
        existingFiles,
        workspaceContextFiles,
      });
      const targetFiles = bundle.files.map((file) => withCodePrefix(file.path, this.codePathPrefix));
      await this.emitCodeActivity({
        owner,
        targetDirectory: this.codeOutputDir,
        files: targetFiles,
        writtenFiles: [],
        currentFile: null,
        state: "queued",
        timestamp: new Date().toISOString(),
      });

      const update = await runImplementationUpdate({
        client: this.client,
        role: owner,
        userRequest,
        messages: ownerMessages,
        task,
        targetFiles,
        backendSpec,
        frontendSpec,
        aiFeaturesSpec,
        infraSpec,
        testSpec,
      });
      const updateMessage = chat.addAgentMessage(owner, formatImplementationUpdate(update));
      await this.emitMessage(updateMessage);

      const writtenCodeArtifacts = await writeArtifacts(
        this.codeOutputDir,
        bundle.files.map((file) => ({
          filename: withCodePrefix(file.path, this.codePathPrefix),
          content: file.content,
        })),
        {
          onArtifactWritten: async (artifact, writtenArtifacts) => {
            artifacts = mergeArtifacts(artifacts, [artifact]);
            await this.hooks?.onArtifacts?.(artifacts);
            await this.emitCodeActivity({
              owner,
              targetDirectory: this.codeOutputDir,
              files: targetFiles,
              writtenFiles: writtenArtifacts.map((item) => item.filename),
              currentFile: artifact.filename,
              state: writtenArtifacts.length === targetFiles.length ? "completed" : "writing",
              timestamp: new Date().toISOString(),
            });
          },
        },
      );
      codeArtifacts = mergeArtifacts(codeArtifacts, writtenCodeArtifacts);
      workspaceFiles = uniqueCodePaths([
        ...workspaceFiles,
        ...writtenCodeArtifacts.map((artifact) => stripCodePrefix(artifact.filename, this.codePathPrefix)),
      ]);

      let latestArtifacts = writtenCodeArtifacts;
      let latestTargetMessage = updateMessage;
      let latestTargetFiles = targetFiles;
      let latestVerificationChecks = await runWorkspaceVerification({
        projectRoot: this.projectRootDir,
        generatedArtifacts: latestArtifacts,
        toolingRoot: process.cwd(),
        mode: "partial",
      });
      await this.emitMessage(chat.addAgentMessage("test", formatVerificationReport(owner, latestVerificationChecks)));
      const reviewers = codingOrder.filter((role) => role !== owner);

      for (let reviewRound = 1; reviewRound <= MAX_CODE_REVIEW_ROUNDS && reviewers.length > 0; reviewRound += 1) {
        const reviews: Array<{ reviewer: DiscussionRole; review: ImplementationReview }> = [];
        const autoTestRepairReview = buildVerificationRepairReview({
          targetMessage: latestTargetMessage,
          targetFiles: latestTargetFiles,
          verificationChecks: latestVerificationChecks,
          messages: chat.getMessages(),
        });

        if (autoTestRepairReview) {
          reviews.push({ reviewer: "test", review: autoTestRepairReview });
          await this.emitMessage(chat.addAgentMessage("test", formatImplementationReview(autoTestRepairReview)));
        }

        for (const reviewer of reviewers) {
          if (reviewer === "test" && autoTestRepairReview) {
            continue;
          }
          const reviewerMessages = this.buildRoleScopedMessages(chat, reviewer, projectMemory);
          const review = await runImplementationReview({
            client: this.client,
            role: reviewer,
            userRequest,
            messages: reviewerMessages,
            targetMessage: latestTargetMessage,
            targetFiles: latestArtifacts.map((artifact) => artifact.filename),
            generatedArtifacts: latestArtifacts,
            verificationChecks: latestVerificationChecks,
          });
          reviews.push({ reviewer, review });
          await this.emitMessage(chat.addAgentMessage(reviewer, formatImplementationReview(review)));
        }

        const hasFailedVerification = latestVerificationChecks.some((check) => check.status === "failed");
        if (reviews.every((item) => item.review.reactionType === "support") && !hasFailedVerification) {
          break;
        }

        const pmInterventionMessage = chat.addAgentMessage(
          "pm",
          formatPmInterventionMessage(owner, reviewRound, reviews, latestVerificationChecks),
        );
        await this.emitMessage(pmInterventionMessage);

        if (reviewRound === MAX_CODE_REVIEW_ROUNDS) {
          unresolvedReviewFindings.push(
            ...reviews.flatMap((item) => item.review.findings),
            ...latestVerificationChecks
              .filter((check) => check.status === "failed")
              .map((check) => `Blocking: ${check.name} failed. ${check.summary}`),
          );
          await this.emitMessage(chat.addAgentMessage("pm", formatRevisionStopMessage(owner, reviews)));
          break;
        }

        const revisionBundle = await reviseCodeBundle({
          client: this.codegenClient,
          role: owner,
          userRequest,
          messages: this.buildRoleScopedMessages(chat, owner, projectMemory),
          buildBrief,
          task,
          existingFiles: uniqueCodePaths([
            ...existingFiles,
            ...workspaceFiles,
            ...latestArtifacts.map((artifact) => stripCodePrefix(artifact.filename, this.codePathPrefix)),
          ]),
          currentFiles: latestArtifacts.map((artifact) => ({
            path: stripCodePrefix(artifact.filename, this.codePathPrefix),
            purpose: "Current owner file before the latest revision round.",
            content: artifact.content,
          })),
          reviews: reviews.map((item) => ({
            reviewer: item.reviewer,
            reactionType: item.review.reactionType,
            approvedAreas: item.review.approvedAreas,
            findings: item.review.findings,
            adjustment: item.review.adjustment,
          })),
          workspaceContextFiles: await this.loadRoleWorkspaceContextFiles(owner, workspaceFiles),
        });
        const revisedArtifacts = revisionBundle.files.map((file) => ({
          filename: withCodePrefix(file.path, this.codePathPrefix),
          absolutePath: "",
          content: file.content,
        }));
        const revisionMessage = chat.addAgentMessage(
          owner,
          formatRevisionUpdateMessage(owner, reviewRound, reviews, revisedArtifacts),
        );
        await this.emitMessage(revisionMessage);
        latestTargetMessage = revisionMessage;

        const revisedTargetFiles = revisedArtifacts.map((artifact) => artifact.filename);
        await this.emitCodeActivity({
          owner,
          targetDirectory: this.codeOutputDir,
          files: revisedTargetFiles,
          writtenFiles: [],
          currentFile: null,
          state: "queued",
          timestamp: new Date().toISOString(),
        });

        latestArtifacts = await writeArtifacts(
          this.codeOutputDir,
          revisedArtifacts.map((artifact) => ({
            filename: artifact.filename,
            content: artifact.content,
          })),
          {
            onArtifactWritten: async (artifact, writtenArtifacts) => {
              artifacts = mergeArtifacts(artifacts, [artifact]);
              await this.hooks?.onArtifacts?.(artifacts);
              await this.emitCodeActivity({
                owner,
                targetDirectory: this.codeOutputDir,
                files: revisedTargetFiles,
                writtenFiles: writtenArtifacts.map((item) => item.filename),
                currentFile: artifact.filename,
                state: writtenArtifacts.length === revisedTargetFiles.length ? "completed" : "writing",
                timestamp: new Date().toISOString(),
              });
            },
          },
        );
        codeArtifacts = mergeArtifacts(codeArtifacts, latestArtifacts);
        workspaceFiles = uniqueCodePaths([
          ...workspaceFiles,
          ...latestArtifacts.map((artifact) => stripCodePrefix(artifact.filename, this.codePathPrefix)),
        ]);
        latestTargetFiles = revisedTargetFiles;
        latestVerificationChecks = await runWorkspaceVerification({
          projectRoot: this.projectRootDir,
          generatedArtifacts: latestArtifacts,
          toolingRoot: process.cwd(),
          mode: "partial",
        });
        await this.emitMessage(chat.addAgentMessage("test", formatVerificationReport(owner, latestVerificationChecks)));
      }

      const failedVerificationChecks = latestVerificationChecks.filter((check) => check.status === "failed");
      if (failedVerificationChecks.length > 0) {
        unresolvedReviewFindings.push(
          ...failedVerificationChecks.map((check) => `Blocking: ${check.name} failed. ${check.summary}`),
        );
        await this.emitMessage(
          chat.addAgentMessage("pm", formatOwnerRepairDeferralMessage(owner, failedVerificationChecks)),
        );
      }
    }

    let finalVerificationChecks = await runWorkspaceVerification({
      projectRoot: this.projectRootDir,
      generatedArtifacts: codeArtifacts,
      toolingRoot: process.cwd(),
      mode: "full",
    });
    await this.emitMessage(chat.addAgentMessage("test", formatVerificationReport("final workspace", finalVerificationChecks)));
    let finalFailedVerificationChecks = finalVerificationChecks.filter((check) => check.status === "failed");
    if (finalFailedVerificationChecks.length > 0) {
      unresolvedReviewFindings.push(
        ...finalFailedVerificationChecks.map((check) => `Blocking: ${check.name} failed. ${check.summary}`),
      );
      const repairResult = await this.runAutonomousRepairLoop({
        userRequest,
        chat,
        ...(projectMemory ? { projectMemory } : {}),
        buildBrief,
        implementationPlan,
        codingOrder,
        artifacts,
        codeArtifacts,
        workspaceFiles,
        verificationChecks: finalVerificationChecks,
      });
      artifacts = repairResult.artifacts;
      codeArtifacts = repairResult.codeArtifacts;
      workspaceFiles = repairResult.workspaceFiles;
      finalVerificationChecks = repairResult.verificationChecks;
      finalFailedVerificationChecks = finalVerificationChecks.filter((check) => check.status === "failed");
      unresolvedReviewFindings.push(...repairResult.unresolvedFindings);

      if (finalFailedVerificationChecks.length > 0) {
        await this.emitMessage(
          chat.addAgentMessage("pm", formatVerificationGateWarning("Final workspace", finalFailedVerificationChecks)),
        );
      }
    }

    await this.emitMessage(chat.addAgentMessage("pm", formatCodingWrapUpMessage(codeArtifacts)));
    await this.emitPhase("coding", "코드 구현", "completed", "역할별 코드 생성과 상호 리뷰가 마무리되었습니다.");

    workspaceFiles = await listWorkspaceFiles(this.projectRootDir).catch(() => workspaceFiles);
    await persistProjectMemory({
      projectRoot: this.projectRootDir,
      userRequest,
      finalDecision: pmFinal,
      buildBrief,
      implementationPlan,
      artifactFiles: codeArtifacts.map((artifact) => artifact.filename),
      workspaceFiles,
      unresolvedFindings: uniqueReviewLines(unresolvedReviewFindings),
    });

    return {
      userRequest,
      transcript: chat.getMessages(),
      discussion: {
        pmInitial,
        backend,
        frontend,
        ai,
        infra,
        test,
        reactions,
        ...(clarification ? { clarification } : {}),
        pmFinal,
      },
      specs: {
        backend: backendSpec,
        frontend: frontendSpec,
        ai: aiFeaturesSpec,
        infra: infraSpec,
        test: testSpec,
        implementation: implementationPlan,
        buildBrief,
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

  private buildRoleScopedMessages(
    chat: ChatStateManager,
    role: DiscussionRole,
    projectMemory?: ProjectMemory,
  ): ChatMessage[] {
    const baseMessages = chat.getMessages();
    if (!projectMemory) {
      return baseMessages;
    }

    const roleMemory = formatRoleProjectMemoryMessage(role, projectMemory);
    if (!roleMemory) {
      return baseMessages;
    }

    return [
      ...baseMessages,
      {
        id: `ctx-${role}-${baseMessages.length + 1}`,
        speaker: "Project Memory",
        role: "pm",
        content: roleMemory,
        turn: baseMessages.length,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  private async loadRoleWorkspaceContextFiles(
    role: DiscussionRole,
    trackedWorkspaceFiles: string[],
    maxFiles = 6,
  ): Promise<Array<{ path: string; content: string }>> {
    if (this.projectStartMode === "continue") {
      return loadWorkspaceContextFiles(this.projectRootDir, role, maxFiles);
    }

    const roleFiles = uniqueCodePaths(trackedWorkspaceFiles)
      .filter((filePath) => isAllowedRolePath(role, filePath))
      .slice(0, maxFiles);

    const contexts: Array<{ path: string; content: string }> = [];
    for (const filePath of roleFiles) {
      try {
        const content = await readFile(path.resolve(this.projectRootDir, filePath), "utf8");
        contexts.push({
          path: filePath,
          content: content.split(/\r?\n/u).slice(0, 160).join("\n").slice(0, 8_000),
        });
      } catch {
        continue;
      }
    }

    return contexts;
  }

  private async generateImplementationPlanAndEmitPhase(
    userRequest: string,
    finalDecision: OrchestrationResult["discussion"]["pmFinal"],
    backendSpec: OrchestrationResult["specs"]["backend"],
    frontendSpec: OrchestrationResult["specs"]["frontend"],
    aiFeaturesSpec: OrchestrationResult["specs"]["ai"],
    infraSpec: OrchestrationResult["specs"]["infra"],
    testSpec: OrchestrationResult["specs"]["test"],
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
      testSpec,
    });
  }

  private async generateSpecsInParallel(args: {
    userRequest: string;
    finalDecision: OrchestrationResult["discussion"]["pmFinal"];
    backend: BackendDiscussion;
    frontend: FrontendDiscussion;
    ai: AIDiscussion;
    infra: InfraDiscussion;
    test: TestDiscussion;
  }): Promise<GeneratedSpecBundle> {
    const [backendSpec, frontendSpec, aiFeaturesSpec, infraSpec, testSpec] = await Promise.all([
      generateBackendSpec({
        client: this.client,
        userRequest: args.userRequest,
        finalDecision: args.finalDecision,
        backendDiscussion: args.backend,
      }),
      generateFrontendSpec({
        client: this.client,
        userRequest: args.userRequest,
        finalDecision: args.finalDecision,
        frontendDiscussion: args.frontend,
      }),
      generateAIFeaturesSpec({
        client: this.client,
        userRequest: args.userRequest,
        finalDecision: args.finalDecision,
        aiDiscussion: args.ai,
      }),
      generateInfraSpec({
        client: this.client,
        userRequest: args.userRequest,
        finalDecision: args.finalDecision,
        infraDiscussion: args.infra,
      }),
      generateTestSpec({
        client: this.client,
        userRequest: args.userRequest,
        finalDecision: args.finalDecision,
        testDiscussion: args.test,
      }),
    ]);

    return {
      backend: backendSpec,
      frontend: frontendSpec,
      ai: aiFeaturesSpec,
      infra: infraSpec,
      test: testSpec,
    };
  }

  private async runAutonomousRepairLoop(args: {
    userRequest: string;
    chat: ChatStateManager;
    projectMemory?: ProjectMemory;
    buildBrief: BuildBrief;
    implementationPlan: ImplementationPlan;
    codingOrder: DiscussionRole[];
    artifacts: GeneratedArtifact[];
    codeArtifacts: GeneratedArtifact[];
    workspaceFiles: string[];
    verificationChecks: VerificationCheck[];
  }): Promise<{
    artifacts: GeneratedArtifact[];
    codeArtifacts: GeneratedArtifact[];
    workspaceFiles: string[];
    verificationChecks: VerificationCheck[];
    unresolvedFindings: string[];
  }> {
    let artifacts = args.artifacts;
    let codeArtifacts = args.codeArtifacts;
    let workspaceFiles = args.workspaceFiles;
    let verificationChecks = args.verificationChecks;
    const unresolvedFindings: string[] = [];

    for (let cycle = 1; cycle <= MAX_AUTONOMOUS_REPAIR_CYCLES; cycle += 1) {
      const failedChecks = verificationChecks.filter((check) => check.status === "failed");
      if (failedChecks.length === 0) {
        break;
      }

      const owners = this.inferRepairOwners(failedChecks, args.codingOrder);
      await this.emitMessage(
        args.chat.addAgentMessage("pm", formatAutonomousRepairCycleMessage(cycle, failedChecks, owners)),
      );

      let repairedAnyFile = false;
      for (const owner of owners) {
        const task = args.implementationPlan.tasks.find((candidate) => candidate.owner === owner);
        if (!task) {
          continue;
        }

        const workspaceContextFiles = await this.loadRoleWorkspaceContextFiles(owner, workspaceFiles, 12);
        if (workspaceContextFiles.length === 0) {
          continue;
        }

        const targetFiles = workspaceContextFiles.map((file) => withCodePrefix(file.path, this.codePathPrefix));
        const targetMessage = args.chat.addAgentMessage(
          "pm",
          formatAutonomousRepairAssignmentMessage(owner, cycle, targetFiles, failedChecks),
        );
        await this.emitMessage(targetMessage);

        const currentArtifacts = workspaceContextFiles.map((file) => ({
          filename: withCodePrefix(file.path, this.codePathPrefix),
          absolutePath: path.resolve(this.projectRootDir, file.path),
          content: file.content,
        }));

        const reviews: Array<{ reviewer: DiscussionRole; review: ImplementationReview }> = [];
        const autoRepairReview = buildVerificationRepairReview({
          targetMessage,
          targetFiles,
          verificationChecks,
          messages: args.chat.getMessages(),
        });
        if (autoRepairReview) {
          reviews.push({ reviewer: "test", review: autoRepairReview });
          await this.emitMessage(args.chat.addAgentMessage("test", formatImplementationReview(autoRepairReview)));
        }

        for (const reviewer of args.codingOrder.filter((role) => role !== owner)) {
          if (reviewer === "test" && autoRepairReview) {
            continue;
          }
          const review = await runImplementationReview({
            client: this.client,
            role: reviewer,
            userRequest: args.userRequest,
            messages: this.buildRoleScopedMessages(args.chat, reviewer, args.projectMemory),
            targetMessage,
            targetFiles,
            generatedArtifacts: currentArtifacts,
            verificationChecks,
          });
          reviews.push({ reviewer, review });
          await this.emitMessage(args.chat.addAgentMessage(reviewer, formatImplementationReview(review)));
        }

        const revisedBundle = await reviseCodeBundle({
          client: this.codegenClient,
          role: owner,
          userRequest: args.userRequest,
          messages: this.buildRoleScopedMessages(args.chat, owner, args.projectMemory),
          buildBrief: args.buildBrief,
          task,
          existingFiles: uniqueCodePaths([
            ...workspaceFiles,
            ...artifacts
              .map((artifact) => stripCodePrefix(artifact.filename, this.codePathPrefix))
              .filter((filename) => filename.length > 0 && !filename.endsWith(".md")),
          ]),
          currentFiles: workspaceContextFiles.map((file) => ({
            path: file.path,
            purpose: `Current ${owner} workspace file before autonomous repair.`,
            content: file.content,
          })),
          reviews: reviews.map((item) => ({
            reviewer: item.reviewer,
            reactionType: item.review.reactionType,
            approvedAreas: item.review.approvedAreas,
            findings: item.review.findings,
            adjustment: item.review.adjustment,
          })),
          workspaceContextFiles,
        });

        const revisedArtifacts = revisedBundle.files.map((file) => ({
          filename: withCodePrefix(file.path, this.codePathPrefix),
          absolutePath: "",
          content: file.content,
        }));
        if (revisedArtifacts.length === 0) {
          continue;
        }

        await this.emitMessage(
          args.chat.addAgentMessage(owner, formatAutonomousRepairRevisionMessage(owner, cycle, reviews, revisedArtifacts)),
        );

        const writtenArtifacts = await writeArtifacts(
          this.codeOutputDir,
          revisedArtifacts.map((artifact) => ({
            filename: artifact.filename,
            content: artifact.content,
          })),
        );
        repairedAnyFile = repairedAnyFile || writtenArtifacts.length > 0;
        artifacts = mergeArtifacts(artifacts, writtenArtifacts);
        codeArtifacts = mergeArtifacts(codeArtifacts, writtenArtifacts);
        workspaceFiles = uniqueCodePaths([
          ...workspaceFiles,
          ...writtenArtifacts.map((artifact) => stripCodePrefix(artifact.filename, this.codePathPrefix)),
        ]);

        const ownerChecks = await runWorkspaceVerification({
          projectRoot: this.projectRootDir,
          generatedArtifacts: writtenArtifacts,
          toolingRoot: process.cwd(),
          mode: "partial",
        });
        await this.emitMessage(args.chat.addAgentMessage("test", formatVerificationReport(`${owner} repair`, ownerChecks)));
      }

      verificationChecks = await runWorkspaceVerification({
        projectRoot: this.projectRootDir,
        generatedArtifacts: codeArtifacts,
        toolingRoot: process.cwd(),
        mode: "full",
      });
      await this.emitMessage(
        args.chat.addAgentMessage("test", formatVerificationReport(`autonomous repair cycle ${cycle}`, verificationChecks)),
      );

      const cycleFailures = verificationChecks.filter((check) => check.status === "failed");
      if (cycleFailures.length === 0) {
        await this.emitMessage(
          args.chat.addAgentMessage("pm", formatAutonomousRepairSuccessMessage(cycle, owners)),
        );
        break;
      }

      unresolvedFindings.push(...cycleFailures.map((check) => `Blocking: ${check.name} failed. ${check.summary}`));
      if (!repairedAnyFile) {
        await this.emitMessage(
          args.chat.addAgentMessage("pm", formatAutonomousRepairStallMessage(cycle, cycleFailures)),
        );
        break;
      }
    }

    return {
      artifacts,
      codeArtifacts,
      workspaceFiles,
      verificationChecks,
      unresolvedFindings: uniqueReviewLines(unresolvedFindings),
    };
  }

  private inferRepairOwners(
    failedChecks: VerificationCheck[],
    codingOrder: DiscussionRole[],
  ): DiscussionRole[] {
    const owners = new Set<DiscussionRole>();

    for (const check of failedChecks) {
      const haystack = `${check.name}\n${check.summary}\n${check.outputSnippet ?? ""}`.toLowerCase();
      if (/public\/|public\\|app\.js|index\.html|styles\.css|frontend/u.test(haystack)) {
        owners.add("frontend");
      }
      if (/src\/lib|src\\lib|domain\.ts|\bai\b/u.test(haystack)) {
        owners.add("ai");
      }
      if (/tests\/|tests\\|node --test|smoke\.test|contracts\.test|\btest\b/u.test(haystack)) {
        owners.add("test");
      }
      if (/docker|\.env|ops\/|ops\\|compose|infra/u.test(haystack)) {
        owners.add("infra");
      }
      if (/src\/server|src\\server|src\/shared|src\\shared|\/api\/|route|bootstrap|health|typescript check|server did not become ready|analyzeshape|maptoparallelogram|backend/u.test(haystack)) {
        owners.add("backend");
      }
    }

    const ordered = codingOrder.filter((role) => owners.has(role));
    return ordered.length > 0 ? ordered : codingOrder;
  }

  private buildDiscussionOrder(userRequest: string): DiscussionRole[] {
    const roles: DiscussionRole[] = ["backend", "frontend", "ai", "infra", "test"];
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
    if (target) {
      return target;
    }

    const selfTarget = reversed.find((message) => message.role === role);
    if (selfTarget) {
      return selfTarget;
    }

    return messages.at(-1) ?? {
      id: `synthetic-target-${role}`,
      speaker: "PM",
      role: "pm",
      content: "No prior agent message was available, so react to the shared user request and current PM scope.",
      turn: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private async emitMessage(message: ChatMessage): Promise<void> {
    await this.hooks?.onMessage?.(message);
  }

  private async emitCodeActivity(update: CodeActivityUpdate): Promise<void> {
    await this.hooks?.onCodeActivity?.(update);
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

function formatCodingKickoffMessage(buildBrief: BuildBrief, plan: ImplementationPlan, codeOutputDir: string): string {
  return [
    "제목: 구현 단계 시작",
    `앱 이름: ${buildBrief.appName}`,
    `앱 유형: ${buildBrief.appType}`,
    `핵심 목표: ${buildBrief.primaryGoal}`,
    `구현 목표: ${plan.overview}`,
    `코드 출력 경로: ${codeOutputDir}`,
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

function withCodePrefix(filename: string, codePathPrefix: string): string {
  if (!codePathPrefix) {
    return filename;
  }
  return `${codePathPrefix.replace(/[\\/]+$/u, "")}/${filename.replace(/^[\\/]+/u, "")}`;
}

function formatRevisionUpdateMessage(
  owner: DiscussionRole,
  reviewRound: number,
  reviews: Array<{ reviewer: DiscussionRole; review: ImplementationReview }>,
  revisedArtifacts: GeneratedArtifact[],
): string {
  const findings = uniqueReviewLines(reviews.flatMap((item) => item.review.findings)).slice(0, 6);
  const approvedAreas = uniqueReviewLines(reviews.flatMap((item) => item.review.approvedAreas)).slice(0, 4);

  return [
    `Title: ${englishRoleLabel(owner)} revision round ${reviewRound}`,
    "Message Type: revision",
    `Round Summary: ${englishRoleLabel(owner)} is applying review feedback from ${reviews.map((item) => englishRoleLabel(item.reviewer)).join(", ")}.`,
    "Approved Areas Kept:",
    ...approvedAreas.map((item) => `- ${item}`),
    "Issues Being Addressed:",
    ...findings.map((item) => `- ${item}`),
    "Rewritten Files:",
    ...revisedArtifacts.map((artifact) => `- ${artifact.filename}`),
  ].join("\n");
}

function formatRevisionStopMessage(
  owner: DiscussionRole,
  reviews: Array<{ reviewer: DiscussionRole; review: ImplementationReview }>,
): string {
  const blocking = uniqueReviewLines(
    reviews.flatMap((item) => item.review.findings.filter((finding) => finding.startsWith("Blocking:"))),
  ).slice(0, 4);

  return [
    "Title: PM review loop stop",
    `Summary: ${englishRoleLabel(owner)} hit the maximum review rounds for this bundle.`,
    "Open Issues:",
    ...(blocking.length > 0 ? blocking.map((item) => `- ${item}`) : ["- No blocking issue remained, but the review loop reached its cap."]),
  ].join("\n");
}

function formatPmInterventionMessage(
  owner: DiscussionRole,
  reviewRound: number,
  reviews: Array<{ reviewer: DiscussionRole; review: ImplementationReview }>,
  verificationChecks: VerificationCheck[],
): string {
  const blockingFindings = uniqueReviewLines(
    reviews.flatMap((item) => item.review.findings.filter((finding) => finding.startsWith("Blocking:"))),
  ).slice(0, 5);
  const followUps = uniqueReviewLines(
    reviews.flatMap((item) => item.review.findings.filter((finding) => finding.startsWith("Follow-up:"))),
  ).slice(0, 4);
  const failedChecks = verificationChecks.filter((check) => check.status === "failed").slice(0, 4);

  return [
    `Title: PM intervention after ${englishRoleLabel(owner)} review round ${reviewRound}`,
    "Message Type: pm intervention",
    `Summary: PM is forcing the next revision to resolve the highest-risk issues before the owner continues.`,
    "Blocking Priorities:",
    ...(
      blockingFindings.length > 0
        ? blockingFindings.map((item) => `- ${item}`)
        : ["- No reviewer raised a blocking finding in this round."]
    ),
    "Verification Failures:",
    ...(
      failedChecks.length > 0
        ? failedChecks.map((item) => `- ${item.name}: ${item.summary}`)
        : ["- No failed verification check was reported in this round."]
    ),
    "Follow-up Queue:",
    ...(followUps.length > 0 ? followUps.map((item) => `- ${item}`) : ["- No follow-up item remained after reviewer triage."]),
    "PM Direction:",
    `- ${englishRoleLabel(owner)} must fix blocking findings and failed verification checks first.`,
    `- Only after those are cleared should ${englishRoleLabel(owner)} spend effort on follow-up polish items.`,
    `- The next revision should keep already-approved areas intact while narrowing the delta to the listed issues only.`,
  ].join("\n");
}

function formatOwnerRepairDeferralMessage(
  owner: DiscussionRole,
  failedChecks: VerificationCheck[],
): string {
  return [
    `Title: PM defers ${englishRoleLabel(owner)} bundle failure`,
    "Message Type: autonomous repair",
    `Summary: ${englishRoleLabel(owner)} still has failed partial verification checks, but the system will continue and try to repair them in the final workspace loop.`,
    "Open Checks:",
    ...failedChecks.map((check) => `- ${check.name}: ${check.summary}`),
  ].join("\n");
}

function formatAutonomousRepairCycleMessage(
  cycle: number,
  failedChecks: VerificationCheck[],
  owners: DiscussionRole[],
): string {
  return [
    `Title: PM autonomous repair cycle ${cycle}`,
    "Message Type: autonomous repair",
    "Summary: Verification failed, so the agents are entering another analysis and repair round instead of stopping.",
    `Repair Owners: ${owners.map((owner) => englishRoleLabel(owner)).join(", ")}`,
    "Blocking Checks:",
    ...failedChecks.map((check) => `- ${check.name}: ${check.summary}`),
  ].join("\n");
}

function formatAutonomousRepairAssignmentMessage(
  owner: DiscussionRole,
  cycle: number,
  targetFiles: string[],
  failedChecks: VerificationCheck[],
): string {
  return [
    `Title: PM repair assignment for ${englishRoleLabel(owner)} cycle ${cycle}`,
    "Message Type: repair assignment",
    `Summary: ${englishRoleLabel(owner)} must revise its owned files against the failed verification output.`,
    "Target Files:",
    ...targetFiles.map((file) => `- ${file}`),
    "Blocking Checks:",
    ...failedChecks.map((check) => `- ${check.name}: ${check.summary}`),
  ].join("\n");
}

function formatAutonomousRepairRevisionMessage(
  owner: DiscussionRole,
  cycle: number,
  reviews: Array<{ reviewer: DiscussionRole; review: ImplementationReview }>,
  revisedArtifacts: GeneratedArtifact[],
): string {
  const findings = uniqueReviewLines(reviews.flatMap((item) => item.review.findings)).slice(0, 6);
  return [
    `Title: ${englishRoleLabel(owner)} autonomous repair cycle ${cycle}`,
    "Message Type: revision",
    `Round Summary: ${englishRoleLabel(owner)} is rewriting files specifically against failed verification and review findings.`,
    "Issues Being Addressed:",
    ...findings.map((item) => `- ${item}`),
    "Rewritten Files:",
    ...revisedArtifacts.map((artifact) => `- ${artifact.filename}`),
  ].join("\n");
}

function formatAutonomousRepairSuccessMessage(cycle: number, owners: DiscussionRole[]): string {
  return [
    `Title: PM autonomous repair cycle ${cycle} cleared`,
    "Message Type: autonomous repair",
    `Summary: ${owners.map((owner) => englishRoleLabel(owner)).join(", ")} resolved the remaining verification blockers.`,
  ].join("\n");
}

function formatAutonomousRepairStallMessage(
  cycle: number,
  failedChecks: VerificationCheck[],
): string {
  return [
    `Title: PM autonomous repair cycle ${cycle} stalled`,
    "Message Type: autonomous repair",
    "Summary: Another repair round did not change the failing checks, so the session will stop with the current diagnostics.",
    "Remaining Checks:",
    ...failedChecks.map((check) => `- ${check.name}: ${check.summary}`),
  ].join("\n");
}

function uniqueReviewLines(items: string[]): string[] {
  return items.filter((item, index) => item.trim().length > 0 && items.indexOf(item) === index);
}

function uniqueCodePaths(items: string[]): string[] {
  return items.filter((item, index) => item.trim().length > 0 && items.indexOf(item) === index);
}

function stripCodePrefix(filename: string, codePathPrefix: string): string {
  if (!codePathPrefix) {
    return filename.replaceAll("\\", "/");
  }
  const normalizedPrefix = codePathPrefix.replaceAll("\\", "/").replace(/[\\/]+$/u, "");
  const normalizedFilename = filename.replaceAll("\\", "/");
  if (!normalizedFilename.startsWith(`${normalizedPrefix}/`)) {
    return normalizedFilename;
  }
  return normalizedFilename.slice(normalizedPrefix.length + 1);
}

function englishRoleLabel(role: DiscussionRole): string {
  if (role === "backend") {
    return "Backend";
  }
  if (role === "frontend") {
    return "Frontend";
  }
  if (role === "infra") {
    return "Infra";
  }
  if (role === "test") {
    return "Test";
  }
  return "AI";
}

function formatVerificationGateWarning(owner: string, failedChecks: VerificationCheck[]): string {
  return [
    `Title: ${owner} verification gate warning`,
    "Message Type: verification warning",
    `Summary: ${owner} did not fully pass the verification gate. The session will continue with partial results.`,
    "Remaining Issues:",
    ...failedChecks.map((check) => `- ${check.name}: ${check.summary}`),
    "Note:",
    "- 의존성(npm install)이 설치되지 않은 생성 프로젝트에서는 일부 검증이 불가합니다.",
    "- 생성된 코드를 실제 사용하려면 npm install 후 다시 검증하세요.",
  ].join("\n");
}
