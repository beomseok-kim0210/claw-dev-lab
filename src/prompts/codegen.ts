import type { AgentRole, ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import type { BuildBrief, GeneratedCodeFile } from "../types/generation.js";
import { buildHarnessPrompt } from "./shared.js";

type CodingRole = Exclude<AgentRole, "pm">;

export function buildCodeBundlePrompt(args: {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  existingFiles: string[];
  workspaceContextFiles?: Array<{ path: string; content: string }>;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective:
      `${roleLabel(args.role)} must decide the concrete file plan for the assigned task before writing files one by one.`,
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
        title: "Known Workspace Files",
        lines: args.existingFiles.length > 0 ? args.existingFiles.map((item) => `- ${item}`) : ["- none"],
      },
      ...(args.workspaceContextFiles && args.workspaceContextFiles.length > 0
        ? [
            {
              title: "Relevant Existing File Contents",
              lines: renderWorkspaceContext(args.workspaceContextFiles),
            },
          ]
        : []),
    ],
    contract: {
      schemaLines: [
        `  "role": "${args.role}",`,
        '  "summary": "Short summary of the file plan",',
        '  "files": [',
        "    {",
        '      "path": "src/server.ts",',
        '      "purpose": "Why this file exists"',
        "    }",
        "  ],",
        '  "validation": ["validation item 1", "validation item 2"]',
      ],
      constraints: [
        "Return a file plan only. Do not include file content yet.",
        "Do not return the same path twice in one plan.",
        "You may update an existing workspace file when it is relevant to the assigned task.",
        "Do not build a brief viewer, admin console, or feature-list page as the main experience unless the request explicitly asks for that.",
        "The first screen must demonstrate the core user interaction of the requested product.",
        "If the request mentions camera, gesture, drawing, upload, chat, search, or dashboard workflows, implement that interaction in the UI instead of only describing it.",
        "Do not use TODO, placeholder, or omitted sections.",
        "Keep the Node.js runtime dependency-free. Browser-side CDN scripts or HTTPS dynamic imports are allowed only when the request explicitly needs them.",
        "If you write TypeScript imports, use explicit .js extensions for relative imports.",
      ],
    },
  });
}

export function buildCodeFilePrompt(args: {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  targetFile: {
    path: string;
    purpose: string;
  };
  existingFiles: string[];
  workspaceContextFiles?: Array<{ path: string; content: string }>;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective: `${roleLabel(args.role)} must write one concrete file that belongs to the assigned task.`,
    responsibilities: [
      ...roleResponsibilities(args.role),
      "Generate one complete file at a time.",
      "Return the full content for the target file, not a diff and not a bundle summary.",
    ],
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
        title: "Target File",
        lines: [`- path: ${args.targetFile.path}`, `- purpose: ${args.targetFile.purpose}`],
      },
      {
        title: "Known Workspace Files",
        lines: args.existingFiles.length > 0 ? args.existingFiles.map((item) => `- ${item}`) : ["- none"],
      },
      ...(args.workspaceContextFiles && args.workspaceContextFiles.length > 0
        ? [
            {
              title: "Relevant Existing File Contents",
              lines: renderWorkspaceContext(args.workspaceContextFiles),
            },
          ]
        : []),
    ],
    contract: {
      schemaLines: [
        `  "path": "${args.targetFile.path}",`,
        `  "purpose": "${args.targetFile.purpose}",`,
        '  "content": "The full file content"',
      ],
      constraints: [
        `path must be exactly "${args.targetFile.path}".`,
        `purpose must stay aligned with "${args.targetFile.purpose}".`,
        "Return one full file only.",
        "If this file depends on exported types or contracts from another file, match those fields exactly or update the owning contract file in the same task.",
        "Do not use TODO, placeholder, or omitted sections.",
        "If you write TypeScript imports, use explicit .js extensions for relative imports.",
      ],
    },
  });
}

export function buildCodeRevisionPrompt(args: {
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
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective: `${roleLabel(args.role)} must revise the current file bundle using concrete review feedback instead of regenerating from scratch.`,
    responsibilities: [
      ...roleResponsibilities(args.role),
      "Treat the current owner files as the baseline implementation.",
      "Fix every blocking finding unless the file content already proves the finding wrong.",
      "Return the files that should exist after the revision round.",
    ],
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
        title: "Review Feedback",
        lines: renderReviewContext(args.reviews),
      },
      {
        title: "Current Owner Files",
        lines: renderCurrentFiles(args.currentFiles),
      },
      {
        title: "Known Workspace Files",
        lines: args.existingFiles.length > 0 ? args.existingFiles.map((item) => `- ${item}`) : ["- none"],
      },
      ...(args.workspaceContextFiles && args.workspaceContextFiles.length > 0
        ? [
            {
              title: "Relevant Existing File Contents",
              lines: renderWorkspaceContext(args.workspaceContextFiles),
            },
          ]
        : []),
    ],
    contract: {
      schemaLines: [
        `  "role": "${args.role}",`,
        '  "summary": "Short summary of the revised file bundle",',
        '  "files": [',
        "    {",
        '      "path": "src/server.ts",',
        '      "purpose": "Why this file exists after the revision",',
        '      "content": "The full revised file content"',
        "    }",
        "  ],",
        '  "validation": ["how the revision addressed the review"]',
      ],
      constraints: [
        "Use the current owner files as the baseline and revise them concretely.",
        "Address blocking findings before optional polish items.",
        "Do not return duplicate file paths.",
        "You may keep a file unchanged if it already satisfies the review, but the returned bundle must still reflect the final state.",
        "Do not regress the main product interaction into a brief viewer or summary page.",
        "Preserve or strengthen the request-specific core interaction on the first screen.",
        "Do not use TODO, placeholder, or omitted sections.",
        "Keep the Node.js runtime dependency-free. Browser-side CDN scripts or HTTPS dynamic imports are allowed only when the request explicitly needs them.",
        "If you write TypeScript imports, use explicit .js extensions for relative imports.",
      ],
    },
  });
}

export function buildCodeFileRevisionPrompt(args: {
  role: CodingRole;
  userRequest: string;
  messages: ChatMessage[];
  buildBrief: BuildBrief;
  task: ImplementationPlan["tasks"][number];
  currentFile: GeneratedCodeFile;
  reviews: Array<{
    reviewer: CodingRole;
    reactionType: "challenge" | "support" | "refine";
    approvedAreas: string[];
    findings: string[];
    adjustment: string;
  }>;
  existingFiles: string[];
  workspaceContextFiles?: Array<{ path: string; content: string }>;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return buildHarnessPrompt({
    role: args.role,
    mode: "implementation",
    objective: `${roleLabel(args.role)} must revise one concrete file using the latest review findings.`,
    responsibilities: [
      ...roleResponsibilities(args.role),
      "Treat the current file as the baseline implementation.",
      "Keep already-approved parts stable while fixing blocking issues first.",
    ],
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
        title: "Current File",
        lines: renderCurrentFiles([args.currentFile]),
      },
      {
        title: "Review Feedback",
        lines: renderReviewContext(args.reviews),
      },
      {
        title: "Known Workspace Files",
        lines: args.existingFiles.length > 0 ? args.existingFiles.map((item) => `- ${item}`) : ["- none"],
      },
      ...(args.workspaceContextFiles && args.workspaceContextFiles.length > 0
        ? [
            {
              title: "Relevant Existing File Contents",
              lines: renderWorkspaceContext(args.workspaceContextFiles),
            },
          ]
        : []),
    ],
    contract: {
      schemaLines: [
        `  "path": "${args.currentFile.path}",`,
        `  "purpose": "${args.currentFile.purpose}",`,
        '  "content": "The full revised file content"',
      ],
      constraints: [
        `path must be exactly "${args.currentFile.path}".`,
        "Return one full revised file only.",
        "Address blocking findings before polish items.",
        "If this file depends on exported types or contracts from another file, keep the field names aligned with those contracts or revise the contract owner file in the same task.",
        "Do not use TODO, placeholder, or omitted sections.",
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
      "Produce a responsive UI that makes the request-specific product interaction visible immediately.",
      "Keep the browser code dependency-free and directly compatible with the bootstrap payload.",
      "Prioritize mobile usability when the request hints at mobile or app usage.",
      "Do not stop at showing lists or markdown-style summaries when the request expects an actual product surface.",
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

function renderWorkspaceContext(files: Array<{ path: string; content: string }>): string[] {
  return files.flatMap((file) => [`- path: ${file.path}`, ...file.content.split("\n").map((line) => `  ${line}`)]);
}

function renderCurrentFiles(files: GeneratedCodeFile[]): string[] {
  return files.flatMap((file) => [
    `- path: ${file.path}`,
    `  purpose: ${file.purpose}`,
    ...file.content.split("\n").map((line) => `  ${line}`),
  ]);
}

function renderReviewContext(
  reviews: Array<{
    reviewer: CodingRole;
    reactionType: "challenge" | "support" | "refine";
    approvedAreas: string[];
    findings: string[];
    adjustment: string;
  }>,
): string[] {
  return reviews.flatMap((review) => [
    `- reviewer: ${roleLabel(review.reviewer)}`,
    `  reactionType: ${review.reactionType}`,
    ...review.approvedAreas.map((item) => `  approved: ${item}`),
    ...review.findings.map((item) => `  finding: ${item}`),
    `  adjustment: ${review.adjustment}`,
  ]);
}
