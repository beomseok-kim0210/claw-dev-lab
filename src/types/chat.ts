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
  pm: "PM Agent",
  backend: "Backend Agent",
  frontend: "Frontend Agent",
  ai: "AI Specialist",
};

export type ArtifactFileName = "backend-spec.md" | "frontend-spec.md" | "ai-features.md";
