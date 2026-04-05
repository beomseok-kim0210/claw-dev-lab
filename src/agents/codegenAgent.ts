import { builtinModules } from "node:module";
import path from "node:path";

import { resolveGenerationProfile } from "../llm/modelProfiles.js";
import { OllamaClient } from "../llm/ollamaClient.js";
import { buildCodeBundlePrompt, buildCodeRevisionPrompt } from "../prompts/codegen.js";
import type { ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import {
  type BuildBrief,
  type GeneratedCodeBundle,
  type GeneratedCodeFile,
  generatedCodeBundleSchema,
} from "../types/generation.js";
import { buildFallbackCodeBundle, listFallbackProjectPaths } from "./codeScaffolder.js";
import { isAllowedRolePath, normalizeGeneratedPath, type CodingRole } from "./codegenPaths.js";

const BUILTIN_IMPORTS = new Set(
  builtinModules.flatMap((item) => (item.startsWith("node:") ? [item, item.slice(5)] : [item, `node:${item}`])),
);
const SAFE_DEV_DEPENDENCIES = new Set(["@types/node", "tsx", "typescript"]);
const PLACEHOLDER_PATTERN = /\b(?:todo|placeholder|fill me|omit(?:ted)?|lorem ipsum)\b/i;

export async function generateCodeBundle(args: {
  client: OllamaClient;
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  existingFiles: string[];
  workspaceContextFiles?: Array<{ path: string; content: string }>;
}): Promise<GeneratedCodeBundle> {
  const prompt = buildCodeBundlePrompt(args);
  const profile = resolveGenerationProfile(args.client.getModelName(), "codegen");

  try {
    const generated = await args.client.generateStructured({
      ...prompt,
      schema: generatedCodeBundleSchema,
      ...profile,
    });

    return normalizeBundle(args, generated);
  } catch {
    return buildFallbackCodeBundle(args);
  }
}

export async function reviseCodeBundle(args: {
  client: OllamaClient;
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
  const prompt = buildCodeRevisionPrompt(args);
  const profile = resolveGenerationProfile(args.client.getModelName(), "codegen");

  try {
    const generated = await args.client.generateStructured({
      ...prompt,
      schema: generatedCodeBundleSchema,
      ...profile,
    });

    return normalizeRevisionBundle(args, generated);
  } catch {
    return buildCurrentBundle(args.role, args.currentFiles, args.reviews);
  }
}

function normalizeBundle(
  args: {
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
    workspaceContextFiles?: Array<{ path: string; content: string }>;
  },
  bundle: GeneratedCodeBundle,
): GeneratedCodeBundle {
  const normalizedFiles = bundle.files.map((file) => ({
    ...file,
    path: normalizeGeneratedPath(file.path),
  }));

  const hasDuplicatePath = normalizedFiles.some(
    (file, index) => normalizedFiles.findIndex((candidate) => candidate.path === file.path) !== index,
  );
  const hasInvalidPath = normalizedFiles.some((file) => !isAllowedRolePath(args.role, file.path));

  if (hasDuplicatePath || hasInvalidPath) {
    return buildFallbackCodeBundle(args);
  }

  const hydrated = hydrateBundle(args, {
    ...bundle,
    files: normalizedFiles,
  });
  const rewritten = rewriteBundleRelativeImports(args, hydrated);

  if (!isBundleSane(rewritten)) {
    return buildFallbackCodeBundle(args);
  }

  return rewritten;
}

function hydrateBundle(
  args: {
    role: CodingRole;
    userRequest: string;
    messages: ChatMessage[];
    buildBrief: BuildBrief;
    task: ImplementationPlan["tasks"][number];
    existingFiles: string[];
  },
  bundle: GeneratedCodeBundle,
): GeneratedCodeBundle {
  const fallback = buildFallbackCodeBundle(args);
  const merged = new Map<string, GeneratedCodeFile>();

  for (const file of fallback.files) {
    merged.set(file.path, file);
  }
  for (const file of bundle.files) {
    merged.set(file.path, file);
  }

  return {
    ...bundle,
    files: [...merged.values()],
    validation: [...new Set([...bundle.validation, ...fallback.validation])].slice(0, 6),
  };
}

function rewriteBundleRelativeImports(
  args: {
    existingFiles: string[];
  },
  bundle: GeneratedCodeBundle,
): GeneratedCodeBundle {
  const knownPaths = new Set<string>([
    ...args.existingFiles.map((item) => normalizeGeneratedPath(item)),
    ...listFallbackProjectPaths(),
    ...bundle.files.map((file) => file.path),
  ]);

  return {
    ...bundle,
    files: bundle.files.map((file) => rewriteRelativeImports(file, knownPaths)),
  };
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

function normalizeRevisionBundle(
  args: {
    role: CodingRole;
    existingFiles: string[];
    currentFiles: GeneratedCodeFile[];
    reviews: Array<{
      reviewer: CodingRole;
      reactionType: "challenge" | "support" | "refine";
      approvedAreas: string[];
      findings: string[];
      adjustment: string;
    }>;
  },
  bundle: GeneratedCodeBundle,
): GeneratedCodeBundle {
  const normalizedFiles = bundle.files.map((file) => ({
    ...file,
    path: normalizeGeneratedPath(file.path),
  }));

  const hasDuplicatePath = normalizedFiles.some(
    (file, index) => normalizedFiles.findIndex((candidate) => candidate.path === file.path) !== index,
  );
  const hasInvalidPath = normalizedFiles.some((file) => !isAllowedRolePath(args.role, file.path));

  if (hasDuplicatePath || hasInvalidPath) {
    return buildCurrentBundle(args.role, args.currentFiles, args.reviews);
  }

  const merged = new Map<string, GeneratedCodeFile>();
  for (const file of args.currentFiles) {
    merged.set(file.path, file);
  }
  for (const file of normalizedFiles) {
    merged.set(file.path, file);
  }

  const rewritten = rewriteBundleRelativeImports(
    {
      existingFiles: [...args.existingFiles, ...args.currentFiles.map((file) => file.path)],
    },
    {
      role: args.role,
      summary: bundle.summary,
      files: [...merged.values()],
      validation: uniqueLines([...bundle.validation, ...collectReviewHints(args.reviews)]).slice(0, 6),
    },
  );

  if (!isBundleSane(rewritten)) {
    return buildCurrentBundle(args.role, args.currentFiles, args.reviews);
  }

  return rewritten;
}

function isBundleSane(bundle: GeneratedCodeBundle): boolean {
  if (bundle.files.some((file) => PLACEHOLDER_PATTERN.test(file.content))) {
    return false;
  }

  const packageJsonFile = bundle.files.find((file) => file.path === "package.json");
  if (packageJsonFile && !isPackageJsonSafe(packageJsonFile.content)) {
    return false;
  }

  const knownPaths = new Set<string>([
    ...listFallbackProjectPaths(),
    ...bundle.files.map((file) => file.path),
  ]);

  for (const file of bundle.files) {
    if (!isFileContentSane(file, knownPaths)) {
      return false;
    }
  }

  const htmlFile = bundle.files.find((file) => file.path === "public/index.html");
  const appJsFile = bundle.files.find((file) => file.path === "public/app.js");
  const serverFile = bundle.files.find((file) => file.path === "src/server.ts");

  if (htmlFile && !htmlFile.content.includes('src="/app.js"')) {
    return false;
  }
  if (appJsFile && !appJsFile.content.includes("/api/bootstrap")) {
    return false;
  }
  if (serverFile && !serverFile.content.includes("/api/bootstrap")) {
    return false;
  }

  return true;
}

function isPackageJsonSafe(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = Object.keys(parsed.dependencies ?? {});
    if (dependencies.length > 0) {
      return false;
    }
    return Object.keys(parsed.devDependencies ?? {}).every((item) => SAFE_DEV_DEPENDENCIES.has(item));
  } catch {
    return false;
  }
}

function isFileContentSane(file: GeneratedCodeFile, knownPaths: Set<string>): boolean {
  if (
    file.path !== "Dockerfile" &&
    file.path !== ".env.example" &&
    !/\.(?:html|css|[cm]?[jt]sx?|json|md)$/u.test(file.path)
  ) {
    return false;
  }

  for (const specifier of extractImportSpecifiers(file.content)) {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      if (!resolveRelativeTarget(file.path, specifier, knownPaths)) {
        return false;
      }
      continue;
    }

    if (specifier.startsWith("/") || specifier.startsWith("http://") || specifier.startsWith("https://")) {
      continue;
    }

    if (!BUILTIN_IMPORTS.has(specifier)) {
      return false;
    }
  }

  return true;
}

function extractImportSpecifiers(content: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        matches.push(specifier);
      }
    }
  }

  return matches;
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
