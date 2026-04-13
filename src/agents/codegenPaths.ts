import type { AgentRole } from "../types/chat.js";

export type CodingRole = Exclude<AgentRole, "pm">;

export function normalizeGeneratedPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.?\//u, "");
}

/**
 * Returns glob-like path prefixes of OTHER roles whose files this role needs to see
 * as cross-role context during code generation. This prevents interface deadlocks
 * where roles generate incompatible interfaces because they can't see each other's code.
 */
export function getCrossRoleDependencyPrefixes(role: CodingRole): ReadonlyArray<readonly [CodingRole, string]> {
  if (role === "frontend") {
    // Frontend needs to see backend endpoints and AI export signatures
    return [
      ["backend", "src/server"],
      ["backend", "src/routes/"],
      ["backend", "src/api/"],
      ["backend", "src/shared/"],
      ["ai", "src/lib/"],
      ["ai", "src/ai/"],
    ] as const;
  }

  if (role === "backend") {
    // Backend needs to see AI helpers it may call and shared contracts
    return [
      ["ai", "src/lib/"],
      ["ai", "src/ai/"],
    ] as const;
  }

  if (role === "ai") {
    // AI needs to see backend entry to know how it's consumed
    return [
      ["backend", "src/server"],
      ["backend", "src/shared/"],
    ] as const;
  }

  if (role === "test") {
    // Test needs visibility into all produced code
    return [
      ["backend", "src/server"],
      ["backend", "src/routes/"],
      ["backend", "src/api/"],
      ["backend", "src/shared/"],
      ["frontend", "public/"],
      ["ai", "src/lib/"],
      ["ai", "src/ai/"],
    ] as const;
  }

  // infra — minimal cross-role needs
  return [
    ["backend", "src/server"],
  ] as const;
}

/**
 * Given a list of workspace file paths, returns those belonging to cross-role
 * dependencies that `role` should see as read-only context.
 */
export function filterCrossRoleFiles(role: CodingRole, allFiles: string[], maxFiles = 4): string[] {
  const prefixes = getCrossRoleDependencyPrefixes(role);
  return allFiles
    .filter((filePath) => {
      const normalized = normalizeGeneratedPath(filePath);
      return prefixes.some(([, prefix]) => normalized.startsWith(prefix));
    })
    .slice(0, maxFiles);
}

export function isAllowedRolePath(role: CodingRole, filePath: string): boolean {
  const normalized = normalizeGeneratedPath(filePath);

  if (role === "backend") {
    return (
      normalized === "package.json" ||
      normalized === "tsconfig.json" ||
      normalized.startsWith("src/server") ||
      normalized.startsWith("src/shared/") ||
      normalized.startsWith("src/data/") ||
      normalized.startsWith("src/routes/") ||
      normalized.startsWith("src/api/")
    );
  }

  if (role === "frontend") {
    return (
      normalized.startsWith("public/") ||
      normalized.startsWith("src/client/") ||
      normalized.startsWith("src/ui/") ||
      normalized.startsWith("src/browser/")
    );
  }

  if (role === "ai") {
    return normalized.startsWith("src/lib/") || normalized.startsWith("src/ai/");
  }

  if (role === "test") {
    return normalized.startsWith("tests/") || normalized.startsWith("src/test/");
  }

  return (
    normalized === ".env.example" ||
    normalized === "Dockerfile" ||
    normalized === "docker-compose.yml" ||
    normalized.startsWith("ops/")
  );
}
