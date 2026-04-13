import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import type { LLMClient } from "../llm/llmClient.js";
import {
  buildCodeBundlePrompt,
  buildCodeFilePrompt,
  buildCodeFileRevisionPrompt,
} from "../prompts/codegen.js";
import { buildConversationMessages } from "../prompts/shared.js";
import type { ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import {
  type BuildBrief,
  type GeneratedCodeBundle,
  type GeneratedCodeFile,
  type GeneratedCodePlan,
  type GeneratedCodePlanFile,
  generatedCodeBundleSchema,
  generatedCodeFileSchema,
  generatedCodePlanSchema,
} from "../types/generation.js";
import { isAllowedRolePath, normalizeGeneratedPath, type CodingRole } from "./codegenPaths.js";
import { buildFallbackCodeBundle } from "./codeScaffolder.js";

const PLACEHOLDER_PATTERN = /\b(?:todo|placeholder|fill me|omit(?:ted)?|lorem ipsum)\b/i;

export async function generateCodeBundle(args: {
  client: LLMClient;
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  existingFiles: string[];
  workspaceContextFiles?: Array<{ path: string; content: string }>;
}): Promise<GeneratedCodeBundle> {
  const profile = resolveGenerationProfile(args.client.getModelName(), "codegen");
  const plan = await generateBundlePlan(args, profile);
  const files = await generatePlannedFiles(args, profile, plan.files);

  if (files.length === 0) {
    return safelyRecoverOrFallback(args, plan);
  }

  return finalizeBundle(
    args,
    {
      role: args.role,
      summary: plan.summary,
      files,
      validation: plan.validation,
    },
    () => safelyRecoverOrFallback(args, plan),
  );
}

export async function reviseCodeBundle(args: {
  client: LLMClient;
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  existingFiles: string[];
  currentFiles: GeneratedCodeFile[];
  reviews: Array<{
    reviewer: CodingRole;
    reactionType: "challenge" | "support" | "refine";
    approvedAreas: string[];
    findings: string[];
    adjustment: string;
  }>;
  workspaceContextFiles?: Array<{ path: string; content: string }>;
}): Promise<GeneratedCodeBundle> {
  const profile = resolveGenerationProfile(args.client.getModelName(), "codegen");
  const revisedFiles = await reviseFilesIndividually(args, profile);

  if (revisedFiles.length === 0) {
    return buildCurrentBundle(args.role, args.currentFiles, args.reviews);
  }

  return finalizeBundle(
    args,
    {
      role: args.role,
      summary: `Revised ${revisedFiles.length} file(s) for ${args.task.title}.`,
      files: mergeCurrentAndRevisedFiles(args.currentFiles, revisedFiles),
      validation: uniqueLines([
        ...args.reviews.flatMap((review) => review.findings),
        ...args.reviews.map((review) => review.adjustment),
      ]).slice(0, 6),
    },
    () => buildCurrentBundle(args.role, args.currentFiles, args.reviews),
  );
}

async function generateBundlePlan(
  args: {
    client: LLMClient;
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  profile: ReturnType<typeof resolveGenerationProfile>,
): Promise<GeneratedCodePlan> {
  const prompt = buildCodeBundlePrompt(args);

  try {
    const generated = await args.client.generateStructured({
      ...prompt,
      conversationMessages: buildConversationMessages(args.messages),
      schema: generatedCodePlanSchema,
      ...profile,
    });
    const normalized = normalizePlan(args.role, generated);
    if (normalized.files.length > 0) {
      return normalized;
    }
  } catch {
    // fall through to deterministic plan
  }

  return deriveDeterministicPlan(args);
}

async function generatePlannedFiles(
  args: {
    client: LLMClient;
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  profile: ReturnType<typeof resolveGenerationProfile>,
  files: GeneratedCodePlanFile[],
): Promise<GeneratedCodeFile[]> {
  const generatedFiles: GeneratedCodeFile[] = [];

  for (const targetFile of files) {
    // 이전에 생성된 파일들을 컨텍스트로 함께 전달한다.
    // 이렇게 해야 app.js가 index.html의 DOM 요소를 참조하거나,
    // 프론트엔드가 백엔드 API 경로를 정확히 맞출 수 있다.
    const previouslyGenerated = generatedFiles.map((file) => ({
      path: file.path,
      content: file.content,
    }));
    const combinedWorkspaceContext = [
      ...(args.workspaceContextFiles ?? []),
      ...previouslyGenerated,
    ];

    const prompt = buildCodeFilePrompt({
      ...args,
      targetFile,
      workspaceContextFiles: combinedWorkspaceContext,
      existingFiles: [
        ...args.existingFiles,
        ...generatedFiles.map((file) => file.path),
      ],
    });

    try {
      const generated = await args.client.generateStructured({
        ...prompt,
        conversationMessages: buildConversationMessages(args.messages),
        schema: generatedCodeFileSchema,
        ...profile,
      });
      const normalized = normalizeFile(targetFile, generated);
      if (isGeneratedFileSane(normalized)) {
        generatedFiles.push(normalized);
        continue;
      }
    } catch {
      // fall through to recovery
    }

    const fallbackFile = resolveFallbackFile(args, targetFile);
    if (fallbackFile && isGeneratedFileSane(fallbackFile)) {
      generatedFiles.push(fallbackFile);
    }
  }

  return generatedFiles;
}

async function reviseFilesIndividually(
  args: {
    client: LLMClient;
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
    currentFiles: GeneratedCodeFile[];
    reviews: Array<{
      reviewer: CodingRole;
      reactionType: "challenge" | "support" | "refine";
      approvedAreas: string[];
      findings: string[];
      adjustment: string;
    }>;
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  profile: ReturnType<typeof resolveGenerationProfile>,
): Promise<GeneratedCodeFile[]> {
  const revisedFiles: GeneratedCodeFile[] = [];

  for (const currentFile of args.currentFiles) {
    const prompt = buildCodeFileRevisionPrompt({
      ...args,
      currentFile,
    });

    try {
      const generated = await args.client.generateStructured({
        ...prompt,
        conversationMessages: buildConversationMessages(args.messages),
        schema: generatedCodeFileSchema,
        ...profile,
      });
      const normalized = normalizeFile(currentFile, generated);
      revisedFiles.push(isGeneratedFileSane(normalized) ? normalized : currentFile);
    } catch {
      revisedFiles.push(currentFile);
    }
  }

  return revisedFiles;
}

function finalizeBundle(
  args: {
    role: CodingRole;
    existingFiles: string[];
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  bundle: GeneratedCodeBundle,
  fallbackFactory: () => GeneratedCodeBundle,
): GeneratedCodeBundle {
  const normalizedFiles = bundle.files
    .map((file) => ({
      ...file,
      path: normalizeGeneratedPath(file.path),
    }))
    .filter((file, index, all) => all.findIndex((candidate) => candidate.path === file.path) === index)
    .filter((file) => isAllowedRolePath(args.role, file.path));

  if (normalizedFiles.length === 0) {
    return fallbackFactory();
  }

  const rewritten = rewriteBundleRelativeImports(
    {
      existingFiles: [
        ...args.existingFiles.map((item) => normalizeGeneratedPath(item)),
        ...(args.workspaceContextFiles?.map((item) => normalizeGeneratedPath(item.path)) ?? []),
      ],
    },
    {
      ...bundle,
      role: args.role,
      files: normalizedFiles,
    },
  );

  if (!isBundleSane(rewritten)) {
    return fallbackFactory();
  }

  return generatedCodeBundleSchema.parse(rewritten);
}

function normalizePlan(role: CodingRole, plan: GeneratedCodePlan): GeneratedCodePlan {
  const files = plan.files
    .map((file) => ({
      path: normalizeGeneratedPath(file.path),
      purpose: file.purpose.trim(),
    }))
    .filter((file, index, all) => all.findIndex((candidate) => candidate.path === file.path) === index)
    .filter((file) => isAllowedRolePath(role, file.path));

  return {
    role,
    summary: plan.summary,
    files,
    validation: plan.validation,
  };
}

function normalizeFile(targetFile: GeneratedCodePlanFile | GeneratedCodeFile, generated: GeneratedCodeFile): GeneratedCodeFile {
  return {
    path: normalizeGeneratedPath(targetFile.path),
    purpose: generated.purpose.trim().length > 0 ? generated.purpose : targetFile.purpose,
    content: generated.content,
  };
}

function resolveFallbackFile(
  args: {
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  targetFile: GeneratedCodePlanFile,
): GeneratedCodeFile | undefined {
  const existing = args.workspaceContextFiles?.find(
    (file) => normalizeGeneratedPath(file.path) === normalizeGeneratedPath(targetFile.path),
  );
  if (existing) {
    return {
      path: normalizeGeneratedPath(targetFile.path),
      purpose: targetFile.purpose,
      content: existing.content,
    };
  }

  const scaffoldFile = buildFallbackCodeBundle(args).files.find(
    (file) => normalizeGeneratedPath(file.path) === normalizeGeneratedPath(targetFile.path),
  );
  if (scaffoldFile) {
    return {
      path: normalizeGeneratedPath(scaffoldFile.path),
      purpose: scaffoldFile.purpose,
      content: scaffoldFile.content,
    };
  }

  return undefined;
}

function deriveDeterministicPlan(args: {
  role: CodingRole;
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  existingFiles: string[];
  workspaceContextFiles?: Array<{ path: string; content: string }>;
}): GeneratedCodePlan {
  const candidatePaths = uniqueLines([
    ...args.buildBrief.fileLayout.map((file) => normalizeGeneratedPath(file)),
    ...(args.workspaceContextFiles?.map((file) => normalizeGeneratedPath(file.path)) ?? []),
    ...roleDefaultPaths(args.role),
  ]).filter((filePath) => isAllowedRolePath(args.role, filePath));

  const files = candidatePaths.slice(0, 8).map((filePath) => ({
    path: filePath,
    purpose: inferPurpose(filePath, args.task.title),
  }));

  return {
    role: args.role,
    summary: `Derived a deterministic ${args.role} file plan from the build brief and task ownership.`,
    files,
    validation: uniqueLines([
      ...args.task.acceptanceCriteria,
      `All ${args.role} files must stay within the assigned path boundary.`,
    ]).slice(0, 6),
  };
}

function roleDefaultPaths(role: CodingRole): string[] {
  if (role === "backend") {
    return ["package.json", "tsconfig.json", "src/shared/contracts.ts", "src/server.ts"];
  }
  if (role === "frontend") {
    return ["public/index.html", "public/app.js", "public/styles.css"];
  }
  if (role === "ai") {
    return ["src/lib/domain.ts"];
  }
  if (role === "test") {
    return ["tests/bootstrap.test.mjs", "tests/contracts.test.mjs"];
  }
  return [".env.example", "Dockerfile", "ops/README.md"];
}

function inferPurpose(filePath: string, taskTitle: string): string {
  const normalized = normalizeGeneratedPath(filePath);
  if (normalized === "package.json") {
    return "Package scripts and development dependencies";
  }
  if (normalized === "tsconfig.json") {
    return "TypeScript compiler configuration";
  }
  if (normalized.endsWith("server.ts")) {
    return `Server entry point for ${taskTitle}`;
  }
  if (normalized.endsWith("contracts.ts")) {
    return `Shared contracts needed by ${taskTitle}`;
  }
  if (normalized.endsWith("domain.ts")) {
    return `Domain logic for ${taskTitle}`;
  }
  if (normalized.endsWith("index.html")) {
    return `Primary document shell for ${taskTitle}`;
  }
  if (normalized.endsWith("app.js")) {
    return `Browser interaction logic for ${taskTitle}`;
  }
  if (normalized.endsWith("styles.css")) {
    return `Visual system for ${taskTitle}`;
  }
  if (normalized.endsWith(".test.mjs")) {
    return `Verification coverage for ${taskTitle}`;
  }
  if (normalized === ".env.example") {
    return "Environment defaults for local execution";
  }
  if (normalized === "Dockerfile") {
    return "Container runtime configuration";
  }
  if (normalized.startsWith("ops/")) {
    return `Operational notes for ${taskTitle}`;
  }
  return `File owned by the current task: ${taskTitle}`;
}

function mergeCurrentAndRevisedFiles(currentFiles: GeneratedCodeFile[], revisedFiles: GeneratedCodeFile[]): GeneratedCodeFile[] {
  const merged = new Map<string, GeneratedCodeFile>();
  for (const file of currentFiles) {
    merged.set(normalizeGeneratedPath(file.path), file);
  }
  for (const file of revisedFiles) {
    merged.set(normalizeGeneratedPath(file.path), file);
  }
  return [...merged.values()];
}

function rewriteBundleRelativeImports(
  args: {
    existingFiles: string[];
  },
  bundle: GeneratedCodeBundle,
): GeneratedCodeBundle {
  const knownPaths = new Set<string>([
    ...args.existingFiles.map((item) => normalizeGeneratedPath(item)),
    ...bundle.files.map((file) => file.path),
  ]);

  return {
    ...bundle,
    files: bundle.files.map((file) => rewriteRelativeImports(file, knownPaths)),
  };
}

function recoverBundleFromWorkspace(
  args: {
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  plan?: GeneratedCodePlan,
): GeneratedCodeBundle {
  const targetPaths = new Set(
    plan?.files.map((file) => normalizeGeneratedPath(file.path)).filter((filePath) => isAllowedRolePath(args.role, filePath)) ??
      [],
  );
  const recoveredFiles = (args.workspaceContextFiles ?? [])
    .map((file) => ({
      path: normalizeGeneratedPath(file.path),
      purpose: inferPurpose(file.path, "existing workspace recovery"),
      content: file.content,
    }))
    .filter((file) => isAllowedRolePath(args.role, file.path))
    .filter((file) => targetPaths.size === 0 || targetPaths.has(file.path))
    .slice(0, 8);

  if (recoveredFiles.length === 0) {
    const fallbackBundle = buildFallbackCodeBundle(args);
    const fallbackFiles = fallbackBundle.files
      .map((file) => ({
        ...file,
        path: normalizeGeneratedPath(file.path),
      }))
      .filter((file) => isAllowedRolePath(args.role, file.path))
      .filter((file) => targetPaths.size === 0 || targetPaths.has(file.path));

    if (fallbackFiles.length > 0) {
      return generatedCodeBundleSchema.parse({
        role: args.role,
        summary: `Recovered ${args.role} with deterministic fallback files after generation could not be reused from the workspace.`,
        files: fallbackFiles,
        validation:
          plan?.validation.length && plan.validation.length >= 2
            ? plan.validation.slice(0, 6)
            : fallbackBundle.validation.slice(0, 6),
      });
    }

    const roleWideFallbackFiles = fallbackBundle.files
      .map((file) => ({
        ...file,
        path: normalizeGeneratedPath(file.path),
      }))
      .filter((file) => isAllowedRolePath(args.role, file.path));

    if (roleWideFallbackFiles.length > 0) {
      return generatedCodeBundleSchema.parse({
        role: args.role,
        summary: `Recovered ${args.role} with role-level deterministic fallback files because the planned targets were not reusable yet.`,
        files: roleWideFallbackFiles,
        validation: fallbackBundle.validation.slice(0, 6),
      });
    }

    const planHint = targetPaths.size > 0 ? ` Target files: ${[...targetPaths].join(", ")}.` : "";
    throw new Error(`Code generation for ${args.role} produced no recoverable files.${planHint}`);
  }

  return generatedCodeBundleSchema.parse({
    role: args.role,
    summary: `Recovered ${recoveredFiles.length} ${args.role} file(s) from the existing workspace context.`,
    files: recoveredFiles,
    validation:
      plan?.validation.length && plan.validation.length >= 2
        ? plan.validation.slice(0, 6)
        : [
            `Recovered ${args.role} files must remain valid for the existing workspace.`,
            `The ${args.role} owner must revise recovered files instead of rebuilding from scratch.`,
          ],
  });
}

function safelyRecoverOrFallback(
  args: {
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  plan?: GeneratedCodePlan,
): GeneratedCodeBundle {
  try {
    return recoverBundleFromWorkspace(args, plan);
  } catch {
    const fallback = buildFallbackCodeBundle(args);
    return generatedCodeBundleSchema.parse({
      role: args.role,
      summary: `Recovered ${args.role} with deterministic fallback files because workspace recovery was unavailable.`,
      files: fallback.files
        .map((file) => ({
          ...file,
          path: normalizeGeneratedPath(file.path),
        }))
        .filter((file) => isAllowedRolePath(args.role, file.path)),
      validation: fallback.validation.slice(0, 6),
    });
  }
}

function rewriteRelativeImports(file: GeneratedCodeFile, knownPaths: Set<string>): GeneratedCodeFile {
  if (!/\.(?:[cm]?[jt]sx?)$/u.test(file.path)) {
    return file;
  }

  let content = file.content;
  const replacers = [
    /(from\s+["'])([^"']+)(["'])/g,
    /(import\s*\(\s*["'])([^"']+)(["']\s*\))/g,
    /(require\(\s*["'])([^"']+)(["']\s*\))/g,
  ];

  for (const pattern of replacers) {
    content = content.replace(pattern, (full, prefix, specifier, suffix) => {
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
        return full;
      }
      const resolved = resolveRelativeTarget(file.path, specifier, knownPaths);
      if (!resolved) {
        return full;
      }
      return `${prefix}${toImportSpecifier(file.path, resolved)}${suffix}`;
    });
  }

  return {
    ...file,
    content,
  };
}

function resolveRelativeTarget(importerPath: string, specifier: string, knownPaths: Set<string>): string | undefined {
  const importerDir = path.posix.dirname(importerPath);
  const rawTarget = path.posix.normalize(path.posix.join(importerDir, specifier));
  const candidates = [
    rawTarget,
    withTypeScriptPath(rawTarget),
    withJavaScriptPath(rawTarget),
    `${rawTarget}.ts`,
    `${rawTarget}.tsx`,
    `${rawTarget}.js`,
    `${rawTarget}.mjs`,
    `${rawTarget}/index.ts`,
    `${rawTarget}/index.tsx`,
    `${rawTarget}/index.js`,
    `${rawTarget}/index.mjs`,
  ].map((item) => normalizeGeneratedPath(item));

  return candidates.find((candidate) => knownPaths.has(candidate));
}

function withTypeScriptPath(filePath: string): string {
  if (filePath.endsWith(".js")) {
    return filePath.replace(/\.js$/u, ".ts");
  }
  if (filePath.endsWith(".mjs")) {
    return filePath.replace(/\.mjs$/u, ".ts");
  }
  return filePath;
}

function withJavaScriptPath(filePath: string): string {
  if (filePath.endsWith(".ts")) {
    return filePath.replace(/\.ts$/u, ".js");
  }
  if (filePath.endsWith(".tsx")) {
    return filePath.replace(/\.tsx$/u, ".js");
  }
  return filePath;
}

function toImportSpecifier(importerPath: string, targetPath: string): string {
  const importerDir = path.posix.dirname(importerPath);
  const relativePath = path.posix.relative(importerDir, targetPath);
  const withDotPrefix = relativePath.startsWith(".") ? relativePath : `./${relativePath}`;

  if (withDotPrefix.endsWith(".ts")) {
    return withDotPrefix.replace(/\.ts$/u, ".js");
  }
  if (withDotPrefix.endsWith(".tsx")) {
    return withDotPrefix.replace(/\.tsx$/u, ".js");
  }

  return withDotPrefix;
}

function isGeneratedFileSane(file: GeneratedCodeFile): boolean {
  if (PLACEHOLDER_PATTERN.test(file.content)) {
    return false;
  }
  if (file.content.trim().length === 0) {
    return false;
  }
  if (/\.(?:[cm]?js)$/u.test(file.path) && !passesNodeSyntaxCheck(file)) {
    return false;
  }
  return true;
}

function passesNodeSyntaxCheck(file: GeneratedCodeFile): boolean {
  const tempDir = mkdtempSync(path.join(tmpdir(), "claw-codegen-"));
  const tempFile = path.join(tempDir, syntaxCheckFileName(file));

  try {
    writeFileSync(tempFile, file.content, "utf8");
    const result = spawnSync(process.execPath, ["--check", tempFile], {
      encoding: "utf8",
      stdio: "pipe",
    });
    return result.status === 0;
  } catch {
    return false;
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function syntaxCheckFileName(file: GeneratedCodeFile): string {
  if (file.path.endsWith(".mjs")) {
    return "syntax-check.mjs";
  }
  if (file.path.endsWith(".cjs")) {
    return "syntax-check.cjs";
  }
  if (/\b(?:import|export)\b/u.test(file.content)) {
    return "syntax-check.mjs";
  }
  return "syntax-check.js";
}

function isBundleSane(bundle: GeneratedCodeBundle): boolean {
  if (bundle.files.some((file) => !isGeneratedFileSane(file))) {
    return false;
  }
  if (bundle.files.length === 0) {
    return false;
  }
  return true;
}

function buildCurrentBundle(
  role: CodingRole,
  currentFiles: GeneratedCodeFile[],
  reviews: Array<{
    findings: string[];
    adjustment: string;
  }>,
): GeneratedCodeBundle {
  return {
    role,
    summary: "Kept the current owner files because the revision response could not be validated safely.",
    files: currentFiles,
    validation: uniqueLines([
      "The current owner bundle was preserved to avoid regressing a valid workspace state.",
      ...collectReviewHints(reviews),
    ]).slice(0, 6),
  };
}

function collectReviewHints(
  reviews: Array<{
    findings: string[];
    adjustment: string;
  }>,
): string[] {
  return reviews.flatMap((review) => [...review.findings, review.adjustment]);
}

function uniqueLines(items: string[]): string[] {
  return items.filter((item, index) => item.trim().length > 0 && items.indexOf(item) === index);
}
