import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ArtifactFileName } from "../types/chat.js";
import type { AIFeaturesSpec, BackendSpec, FrontendSpec, PMFinalDecision } from "../types/contracts.js";
import type { GeneratedArtifact } from "../types/orchestration.js";

export async function writeExecutionArtifacts(args: {
  outputDir: string;
  finalDecision: PMFinalDecision;
  backendSpec: BackendSpec;
  frontendSpec: FrontendSpec;
  aiFeaturesSpec: AIFeaturesSpec;
}): Promise<GeneratedArtifact[]> {
  await mkdir(args.outputDir, { recursive: true });

  const artifacts: Array<{ filename: ArtifactFileName; content: string }> = [
    {
      filename: "backend-spec.md",
      content: renderBackendSpecMarkdown(args.finalDecision, args.backendSpec),
    },
    {
      filename: "frontend-spec.md",
      content: renderFrontendSpecMarkdown(args.finalDecision, args.frontendSpec),
    },
    {
      filename: "ai-features.md",
      content: renderAIFeaturesMarkdown(args.finalDecision, args.aiFeaturesSpec),
    },
  ];

  const writtenArtifacts: GeneratedArtifact[] = [];
  for (const artifact of artifacts) {
    const absolutePath = path.resolve(args.outputDir, artifact.filename);
    await writeFile(absolutePath, artifact.content, "utf8");
    writtenArtifacts.push({
      filename: artifact.filename,
      absolutePath,
      content: artifact.content,
    });
  }

  return writtenArtifacts;
}

function renderBackendSpecMarkdown(finalDecision: PMFinalDecision, spec: BackendSpec): string {
  return [
    "# Backend Spec",
    "",
    "## PM Decision",
    spec.overview,
    "",
    "### Final MVP Direction",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## API Design",
    ...spec.apiDesign.map((item) => `- ${item}`),
    "",
    "## Data Model",
    ...spec.dataModel.map((item) => `- ${item}`),
    "",
    "## Technical Constraints",
    ...spec.constraints.map((item) => `- ${item}`),
    "",
    "## Implementation Steps",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## Example Code",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderFrontendSpecMarkdown(finalDecision: PMFinalDecision, spec: FrontendSpec): string {
  return [
    "# Frontend Spec",
    "",
    "## PM Decision",
    spec.overview,
    "",
    "### Final MVP Direction",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## Screens",
    ...spec.screens.map((item) => `- ${item}`),
    "",
    "## Component Hierarchy",
    ...spec.components.map((item) => `- ${item}`),
    "",
    "## Usability Checklist",
    ...spec.usabilityChecklist.map((item) => `- ${item}`),
    "",
    "## Implementation Steps",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## Example Code",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderAIFeaturesMarkdown(finalDecision: PMFinalDecision, spec: AIFeaturesSpec): string {
  return [
    "# AI Features",
    "",
    "## PM Decision",
    spec.overview,
    "",
    "### Final MVP Direction",
    `- ${finalDecision.finalDecision}`,
    ...finalDecision.mvpScope.map((item) => `- ${item}`),
    "",
    "## Proposed AI Features",
    ...spec.features.map((item) => `- ${item}`),
    "",
    "## Feasibility Notes",
    ...spec.feasibilityNotes.map((item) => `- ${item}`),
    "",
    "## Guardrails",
    ...spec.guardrails.map((item) => `- ${item}`),
    "",
    "## Implementation Steps",
    ...spec.implementationSteps.map((item) => `- ${item}`),
    "",
    "## Example Code",
    renderCodeBlock(spec.exampleCode.language, spec.exampleCode.snippet),
  ].join("\n");
}

function renderCodeBlock(language: string, snippet: string): string {
  return ["```" + language, snippet.trim(), "```"].join("\n");
}
