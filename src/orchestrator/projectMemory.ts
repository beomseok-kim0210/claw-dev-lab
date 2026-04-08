import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { isAllowedRolePath, normalizeGeneratedPath, type CodingRole } from "../agents/codegenPaths.js";
import type { PMFinalDecision, ImplementationPlan } from "../types/contracts.js";
import { buildBriefSchema, type BuildBrief } from "../types/generation.js";

const CODING_ROLES = ["backend", "frontend", "ai", "infra", "test"] as const;

const roleProjectMemorySchema = z
  .object({
    ownedFiles: z.array(z.string().min(1)).max(24),
    recentFocus: z.array(z.string().min(1)).max(8),
    openFindings: z.array(z.string().min(1)).max(8),
    validationPriorities: z.array(z.string().min(1)).max(8),
  })
  .strict();

const projectMemorySchema = z
  .object({
    version: z.literal(1),
    updatedAt: z.string(),
    projectRoot: z.string(),
    requestHistory: z
      .array(
        z.object({
          at: z.string(),
          request: z.string().min(1),
        }),
      )
      .max(12),
    latestFinalDecision: z.string().min(1).optional(),
    latestBuildBrief: buildBriefSchema.optional(),
    latestImplementationOverview: z.string().min(1).optional(),
    latestMilestones: z.array(z.string().min(1)).max(8),
    latestValidationChecklist: z.array(z.string().min(1)).max(8),
    latestArtifacts: z.array(z.string().min(1)).max(200),
    workspaceFiles: z.array(z.string().min(1)).max(200),
    unresolvedFindings: z.array(z.string().min(1)).max(20),
    roleMemories: z
      .object({
        backend: roleProjectMemorySchema.optional(),
        frontend: roleProjectMemorySchema.optional(),
        ai: roleProjectMemorySchema.optional(),
        infra: roleProjectMemorySchema.optional(),
        test: roleProjectMemorySchema.optional(),
      })
      .strict(),
  })
  .strict();

export type ProjectMemory = z.infer<typeof projectMemorySchema>;
export type RoleProjectMemory = z.infer<typeof roleProjectMemorySchema>;

type PersistProjectMemoryArgs = {
  projectRoot: string;
  userRequest: string;
  finalDecision: PMFinalDecision;
  buildBrief: BuildBrief;
  implementationPlan: ImplementationPlan;
  artifactFiles: string[];
  workspaceFiles: string[];
  unresolvedFindings: string[];
};

export type WorkspaceContextFile = {
  path: string;
  content: string;
};

const MEMORY_DIRNAME = ".multi-agent";
const MEMORY_FILENAME = "project-memory.json";
const IGNORED_DIRS = new Set([".git", "node_modules", ".multi-agent", ".multi-agent-output", "dist", "coverage"]);

export async function loadProjectMemory(projectRoot: string): Promise<ProjectMemory | undefined> {
  try {
    const content = await readFile(resolveProjectMemoryPath(projectRoot), "utf8");
    return projectMemorySchema.parse(JSON.parse(content));
  } catch {
    return undefined;
  }
}

export async function persistProjectMemory(args: PersistProjectMemoryArgs): Promise<ProjectMemory> {
  const previous = await loadProjectMemory(args.projectRoot);
  const now = new Date().toISOString();
  const next: ProjectMemory = {
    version: 1,
    updatedAt: now,
    projectRoot: args.projectRoot,
    requestHistory: [
      ...(previous?.requestHistory ?? []),
      {
        at: now,
        request: args.userRequest,
      },
    ].slice(-12),
    latestFinalDecision: args.finalDecision.finalDecision,
    latestBuildBrief: args.buildBrief,
    latestImplementationOverview: args.implementationPlan.overview,
    latestMilestones: args.implementationPlan.milestones.slice(0, 8),
    latestValidationChecklist: args.implementationPlan.validationChecklist.slice(0, 8),
    latestArtifacts: unique(args.artifactFiles).slice(0, 200),
    workspaceFiles: unique(args.workspaceFiles).slice(0, 200),
    unresolvedFindings: unique(args.unresolvedFindings).slice(0, 20),
    roleMemories: buildRoleMemories(args),
  };

  const memoryPath = resolveProjectMemoryPath(args.projectRoot);
  await mkdir(path.dirname(memoryPath), { recursive: true });
  await writeFile(memoryPath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function resolveProjectMemoryPath(projectRoot: string): string {
  return path.resolve(projectRoot, MEMORY_DIRNAME, MEMORY_FILENAME);
}

export function formatProjectMemoryMessage(memory: ProjectMemory): string {
  const requestHistory = memory.requestHistory.slice(-3).map((item) => `- ${item.request}`);
  const featureLines = memory.latestBuildBrief?.keyFeatures.slice(0, 5).map((item) => `- ${item}`) ?? [];
  const workspaceLines = memory.workspaceFiles.slice(0, 8).map((item) => `- ${item}`);
  const unresolvedLines = memory.unresolvedFindings.slice(0, 4).map((item) => `- ${item}`);

  return [
    "Title: project memory loaded",
    `Project Root: ${memory.projectRoot}`,
    ...(memory.latestBuildBrief
      ? [
          `Latest App: ${memory.latestBuildBrief.appName}`,
          `Primary Goal: ${memory.latestBuildBrief.primaryGoal}`,
        ]
      : []),
    "Recent Requests:",
    ...(requestHistory.length > 0 ? requestHistory : ["- No prior request history was stored."]),
    "Key Features:",
    ...(featureLines.length > 0 ? featureLines : ["- No prior feature summary was stored."]),
    "Workspace Files:",
    ...(workspaceLines.length > 0 ? workspaceLines : ["- No workspace files were indexed yet."]),
    "Open Findings:",
    ...(unresolvedLines.length > 0 ? unresolvedLines : ["- No unresolved finding remained in the last session."]),
    "Use this memory as the baseline and extend the project instead of rebuilding it from zero.",
  ].join("\n");
}

export function formatRoleProjectMemoryMessage(role: CodingRole, memory: ProjectMemory): string | undefined {
  const roleMemory = memory.roleMemories[role];
  if (!roleMemory) {
    return undefined;
  }

  return [
    `Title: ${role} specialist memory loaded`,
    `Project Root: ${memory.projectRoot}`,
    "Owned Files:",
    ...(roleMemory.ownedFiles.length > 0 ? roleMemory.ownedFiles.map((item) => `- ${item}`) : ["- No owned files recorded yet."]),
    "Recent Focus:",
    ...(roleMemory.recentFocus.length > 0 ? roleMemory.recentFocus.map((item) => `- ${item}`) : ["- No recent focus summary recorded yet."]),
    "Open Findings:",
    ...(roleMemory.openFindings.length > 0 ? roleMemory.openFindings.map((item) => `- ${item}`) : ["- No open findings were assigned to this role."]),
    "Validation Priorities:",
    ...(roleMemory.validationPriorities.length > 0
      ? roleMemory.validationPriorities.map((item) => `- ${item}`)
      : ["- No explicit validation priority was stored."]),
    "Use this specialist memory as your baseline when you discuss, review, or revise code.",
  ].join("\n");
}

export async function listWorkspaceFiles(projectRoot: string): Promise<string[]> {
  const discovered: string[] = [];
  try {
    await walkWorkspace(projectRoot, "", discovered);
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return [];
    }
    throw error;
  }
  return unique(discovered).sort();
}

export async function loadWorkspaceContextFiles(
  projectRoot: string,
  role: CodingRole,
  maxFiles = 6,
): Promise<WorkspaceContextFile[]> {
  const files = (await listWorkspaceFiles(projectRoot))
    .filter((filePath) => isAllowedRolePath(role, filePath))
    .sort((left, right) => scoreWorkspaceFile(role, left) - scoreWorkspaceFile(role, right))
    .slice(0, maxFiles);

  const contexts: WorkspaceContextFile[] = [];
  for (const filePath of files) {
    try {
      const content = await readFile(path.resolve(projectRoot, filePath), "utf8");
      contexts.push({
        path: filePath,
        content: compactWorkspaceContent(content),
      });
    } catch {
      continue;
    }
  }

  return contexts;
}

async function walkWorkspace(projectRoot: string, currentRelative: string, discovered: string[]): Promise<void> {
  const absoluteDir = currentRelative ? path.resolve(projectRoot, currentRelative) : projectRoot;
  const entries = await readdir(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = normalizeGeneratedPath(path.posix.join(currentRelative.replaceAll("\\", "/"), entry.name));
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await walkWorkspace(projectRoot, relativePath, discovered);
      }
      continue;
    }
    discovered.push(relativePath);
  }
}

function compactWorkspaceContent(content: string): string {
  return content.split(/\r?\n/u).slice(0, 160).join("\n").slice(0, 8_000);
}

function scoreWorkspaceFile(role: CodingRole, filePath: string): number {
  const priority = rolePriority(role);
  const matchedIndex = priority.findIndex((prefix) => filePath === prefix || filePath.startsWith(`${prefix}/`));
  return matchedIndex < 0 ? priority.length + filePath.length : matchedIndex;
}

function rolePriority(role: CodingRole): string[] {
  if (role === "backend") {
    return ["package.json", "tsconfig.json", "src/server.ts", "src/shared", "src/api", "src/routes", "src/data"];
  }
  if (role === "frontend") {
    return ["public/index.html", "public/app.js", "public/styles.css", "src/ui", "src/client", "src/browser"];
  }
  if (role === "ai") {
    return ["src/lib/domain.ts", "src/lib", "src/ai"];
  }
  if (role === "infra") {
    return [".env.example", "Dockerfile", "docker-compose.yml", "ops"];
  }
  return ["tests/bootstrap.test.mjs", "tests/contracts.test.mjs", "tests", "src/test"];
}

function unique(items: string[]): string[] {
  return items.filter((item, index) => item.trim().length > 0 && items.indexOf(item) === index);
}

function isMissingDirectoryError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function buildRoleMemories(args: PersistProjectMemoryArgs): ProjectMemory["roleMemories"] {
  const byRole = Object.fromEntries(
    CODING_ROLES.map((role) => [
      role,
      buildRoleMemory(role, args),
    ]),
  ) as ProjectMemory["roleMemories"];

  return byRole;
}

function buildRoleMemory(role: CodingRole, args: PersistProjectMemoryArgs): RoleProjectMemory | undefined {
  const task = args.implementationPlan.tasks.find((candidate) => candidate.owner === role);
  const ownedFiles = unique(
    args.artifactFiles
      .map((file) => stripGeneratedPrefix(file))
      .filter((file) => isAllowedRolePath(role, normalizeGeneratedPath(file))),
  ).slice(0, 24);
  const recentFocus = unique([
    task?.title ?? "",
    task?.goal ?? "",
    ...(task?.deliverables ?? []),
  ]).slice(0, 8);
  const openFindings = unique(
    args.unresolvedFindings.filter((finding) => findingTouchesRole(role, finding, ownedFiles)),
  ).slice(0, 8);
  const validationPriorities = unique([
    ...(task?.acceptanceCriteria ?? []),
    ...args.buildBrief.acceptanceChecks,
  ]).slice(0, 8);

  if (
    ownedFiles.length === 0 &&
    recentFocus.length === 0 &&
    openFindings.length === 0 &&
    validationPriorities.length === 0
  ) {
    return undefined;
  }

  return {
    ownedFiles,
    recentFocus,
    openFindings,
    validationPriorities,
  };
}

function stripGeneratedPrefix(filePath: string): string {
  const normalized = normalizeGeneratedPath(filePath);
  return normalized.startsWith("generated-app/") ? normalized.slice("generated-app/".length) : normalized;
}

function findingTouchesRole(role: CodingRole, finding: string, ownedFiles: string[]): boolean {
  const loweredFinding = finding.toLowerCase();
  if (ownedFiles.some((file) => loweredFinding.includes(file.toLowerCase()))) {
    return true;
  }

  if (role === "backend") {
    return /(api|server|route|contract|backend|node|bootstrap)/iu.test(finding);
  }
  if (role === "frontend") {
    return /(ui|screen|frontend|browser|style|mobile|interaction|html|css)/iu.test(finding);
  }
  if (role === "ai") {
    return /(ai|model|analysis|insight|domain|recommend)/iu.test(finding);
  }
  if (role === "infra") {
    return /(infra|docker|env|deploy|container|ops|runtime)/iu.test(finding);
  }
  return /(test|verify|contract|coverage|assert|check)/iu.test(finding);
}
