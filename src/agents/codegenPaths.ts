import type { AgentRole } from "../types/chat.js";

export type CodingRole = Exclude<AgentRole, "pm">;

export function normalizeGeneratedPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.?\//u, "");
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
