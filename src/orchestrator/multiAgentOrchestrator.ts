import { generateAIFeaturesSpec, formatAIDiscussion, runAIDiscussion } from "../agents/aiAgent.js";
import { generateBackendSpec, formatBackendDiscussion, runBackendDiscussion } from "../agents/backendAgent.js";
import { generateFrontendSpec, formatFrontendDiscussion, runFrontendDiscussion } from "../agents/frontendAgent.js";
import { formatPmFinalDecision, formatPmInitialDiscussion, runPmFinalDecision, runPmInitialDiscussion } from "../agents/pmAgent.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import type { OrchestrationResult } from "../types/orchestration.js";
import { ChatStateManager } from "./chatState.js";
import { writeExecutionArtifacts } from "./outputWriter.js";

type MultiAgentOrchestratorArgs = {
  client: OllamaClient;
  outputDir: string;
};

export class MultiAgentOrchestrator {
  private readonly client: OllamaClient;
  private readonly outputDir: string;

  constructor(args: MultiAgentOrchestratorArgs) {
    this.client = args.client;
    this.outputDir = args.outputDir;
  }

  async run(userRequest: string): Promise<OrchestrationResult> {
    const chat = new ChatStateManager();
    chat.addUserRequest(userRequest);

    const pmInitial = await runPmInitialDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    chat.addAgentMessage("pm", formatPmInitialDiscussion(pmInitial));

    const backend = await runBackendDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    chat.addAgentMessage("backend", formatBackendDiscussion(backend));

    const frontend = await runFrontendDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    chat.addAgentMessage("frontend", formatFrontendDiscussion(frontend));

    const ai = await runAIDiscussion({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    chat.addAgentMessage("ai", formatAIDiscussion(ai));

    const pmFinal = await runPmFinalDecision({
      client: this.client,
      userRequest,
      messages: chat.getMessages(),
    });
    chat.addAgentMessage("pm", formatPmFinalDecision(pmFinal));

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
}
