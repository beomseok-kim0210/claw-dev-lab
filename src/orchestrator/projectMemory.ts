import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { isAllowedRolePath, normalizeGeneratedPath, type CodingRole } from "../agents/codegenPaths.js";
import type { PMFinalDecision, ImplementationPlan } from "../types/contracts.js";
import { buildBriefSchema, type BuildBrief } from "../types/generation.js";

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
  })
  .strict();

export type ProjectMemory = z.infer<typeof projectMemorySchema>;

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

export async function listWorkspaceFiles(projectRoot: string): Promise<string[]> {
  const discovered: string[] = [];
  await walkWorkspace(projectRoot, "", discovered);
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
