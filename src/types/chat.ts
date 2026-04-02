export type ChatRole = "pm" | "backend" | "frontend" | "ai" | "user";

export type ChatMessage = {
  id: string;
  speaker: string;
  role: ChatRole;
  content: string;
  turn: number;
  timestamp: string;
};

export type AgentRole = Exclude<ChatRole, "user">;

export const AGENT_SPEAKERS: Record<AgentRole, string> = {
  pm: "PM 에이전트",
  backend: "백엔드 에이전트",
  frontend: "프론트엔드 에이전트",
  ai: "AI 전문가",
};

export type ArtifactFileName = "backend-spec.md" | "frontend-spec.md" | "ai-features.md";
