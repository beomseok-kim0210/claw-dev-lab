import type { AgentRole, ChatMessage } from "../types/chat.js";

export type HarnessMode = "discussion" | "artifact" | "implementation";

type HarnessContextBlock = {
  title: string;
  lines: string[];
};

type HarnessContract = {
  schemaLines: string[];
  constraints: string[];
};

type HarnessPromptArgs = {
  role: AgentRole;
  mode: HarnessMode;
  objective: string;
  responsibilities: string[];
  userRequest: string;
  messages?: ChatMessage[];
  contextBlocks?: HarnessContextBlock[];
  contract: HarnessContract;
};

const ROLE_LABELS: Record<AgentRole, string> = {
  pm: "PM agent",
  backend: "Backend agent",
  frontend: "Frontend agent",
  ai: "AI agent",
  infra: "Infra agent",
  test: "Test agent",
};

const COMMON_SYSTEM_RULES = [
  "Write explanations and lists in Korean.",
  "Use English only for JSON keys, message IDs, code, file paths, and API names when needed.",
  "Return valid JSON only and do not add markdown fences or extra commentary.",
  "Prefer implementation-ready specificity over abstract planning language.",
];

const MODE_RULES: Record<HarnessMode, string[]> = {
  discussion: [
    "Act like a participant inside a shared team chat room.",
    "Read previous messages before responding and react to concrete points instead of speaking in isolation.",
    "When there is tension or risk, say it clearly instead of smoothing it over.",
  ],
  artifact: [
    "Produce implementation-ready structured output.",
    "Stay inside the PM final decision and do not expand the scope on your own.",
    "Prefer concrete steps, structures, and examples over generic summaries.",
  ],
  implementation: [
    "Break the plan into file-level work that can be executed next.",
    "Keep acceptance checks concrete enough for code review or smoke testing.",
    "Bias toward outputs that the next agent can act on immediately.",
  ],
};

export function buildHarnessPrompt(args: HarnessPromptArgs): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = [
    `Role: ${ROLE_LABELS[args.role]}`,
    `Mode: ${args.mode}`,
    `Objective: ${args.objective}`,
    "Responsibilities:",
    ...args.responsibilities.map((item) => `- ${item}`),
    "Common rules:",
    ...COMMON_SYSTEM_RULES.map((item) => `- ${item}`),
    "Mode rules:",
    ...MODE_RULES[args.mode].map((item) => `- ${item}`),
  ].join("\n");

  const sections: string[] = [];
  if (args.messages) {
    sections.push(renderDiscussionContext(args.userRequest, args.messages));
  } else {
    sections.push(`User request: ${args.userRequest}`);
  }

  for (const block of args.contextBlocks ?? []) {
    sections.push(renderContextBlock(block));
  }

  sections.push("Return JSON only in this shape:");
  sections.push("{");
  sections.push(...args.contract.schemaLines);
  sections.push("}");
  sections.push("");
  sections.push("Constraints:");
  sections.push(...args.contract.constraints.map((item) => `- ${item}`));

  return {
    systemPrompt,
    userPrompt: sections.join("\n\n"),
  };
}

export function renderTranscript(messages: ChatMessage[]): string {
  return messages
    .map((message) =>
      [
        `[${message.id}] turn=${message.turn} speaker=${message.speaker} role=${message.role}`,
        message.content,
      ].join("\n"),
    )
    .join("\n\n");
}

export function renderMessageIds(messages: ChatMessage[]): string {
  return messages.map((message) => message.id).join(", ");
}

export function renderDiscussionContext(userRequest: string, messages: ChatMessage[]): string {
  return [
    `User request: ${userRequest}`,
    `Available message IDs: ${renderMessageIds(messages)}`,
    "Transcript:",
    renderTranscript(messages),
  ].join("\n\n");
}

function renderContextBlock(block: HarnessContextBlock): string {
  return [block.title, ...block.lines].join("\n");
}
