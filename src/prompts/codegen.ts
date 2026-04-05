import type { AgentRole, ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import type { BuildBrief } from "../types/generation.js";
import { buildHarnessPrompt } from "./shared.js";

type CodingRole = Exclude<AgentRole, "pm">;

export function buildCodeBundlePrompt(args: {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  existingFiles: string[];
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective:
      `${roleLabel(args.role)} must generate a concrete file bundle from the build brief and the assigned task.`,
    responsibilities: roleResponsibilities(args.role),
    userRequest: args.userRequest,
    messages: args.messages,
    contextBlocks: [
      {
        title: "Build Brief",
        lines: [
          `- appName: ${args.buildBrief.appName}`,
          `- appType: ${args.buildBrief.appType}`,
          `- primaryGoal: ${args.buildBrief.primaryGoal}`,
          ...args.buildBrief.keyFeatures.map((item) => `- feature: ${item}`),
          ...args.buildBrief.fileLayout.map((item) => `- file: ${item}`),
        ],
      },
      {
        title: "Assigned Task",
        lines: [
          `- taskId: ${args.task.id}`,
          `- title: ${args.task.title}`,
          `- goal: ${args.task.goal}`,
          ...args.task.deliverables.map((item) => `- deliverable: ${item}`),
        ],
      },
      {
        title: "Already Generated Files",
        lines: args.existingFiles.length > 0 ? args.existingFiles.map((item) => `- ${item}`) : ["- none"],
      },
    ],
    contract: {
      schemaLines: [
        `  "role": "${args.role}",`,
        '  "summary": "Short summary of the file bundle",',
        '  "files": [',
        "    {",
        '      "path": "src/server.ts",',
        '      "purpose": "Why this file exists",',
        '      "content": "The full file content"',
        "    }",
        "  ],",
        '  "validation": ["validation item 1", "validation item 2"]',
      ],
      constraints: [
        "Return real files only.",
        "Never overwrite a file that already exists in the generated list.",
        "Do not use TODO, placeholder, or omitted sections.",
        "Use only Node.js built-ins and browser-native APIs. Do not add third-party runtime libraries.",
        "If you write TypeScript imports, use explicit .js extensions for relative imports.",
      ],
    },
  });
}

function roleLabel(role: CodingRole): string {
  if (role === "backend") {
    return "Backend";
  }
  if (role === "frontend") {
    return "Frontend";
  }
  if (role === "infra") {
    return "Infra";
  }
  if (role === "test") {
    return "Test";
  }
  return "AI";
}

function roleResponsibilities(role: CodingRole): string[] {
  if (role === "backend") {
    return [
      "Produce a runnable server entry point and shared contracts.",
      "Favor Node.js built-ins over external libraries.",
      "Keep the bootstrap API shape predictable for the frontend.",
    ];
  }

  if (role === "frontend") {
    return [
      "Produce a responsive UI that renders the build brief clearly.",
      "Keep the browser code dependency-free and directly compatible with the bootstrap payload.",
      "Prioritize mobile usability when the request hints at mobile or app usage.",
    ];
  }

  if (role === "infra") {
    return [
      "Create only environment and operational files.",
      "Keep local run steps obvious and aligned with the generated file layout.",
      "Do not collide with backend, frontend, AI, or test code paths.",
    ];
  }

  if (role === "test") {
    return [
      "Generate runnable smoke tests or contract tests with Node built-ins only.",
      "Keep test files aligned with the generated API, UI, and shared contracts.",
      "Favor deterministic checks over vague testing advice.",
    ];
  }

  return [
    "Generate domain intelligence helpers or analysis modules that enrich the product-specific output.",
    "Keep the logic deterministic and easy for the server or UI to consume.",
    "Avoid vague recommendation text that does not connect back to the request.",
  ];
}
