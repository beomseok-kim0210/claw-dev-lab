export type ChatRole = "pm" | "backend" | "frontend" | "ai" | "infra" | "user";

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
  ai: "AI 에이전트",
  infra: "인프라 에이전트",
};

export const USER_SPEAKER = "사용자";

export type ArtifactFileName = string;
