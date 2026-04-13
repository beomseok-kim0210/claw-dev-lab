import type { AgentRole, ChatMessage } from "../types/chat.js";
import type { ImplementationPlan } from "../types/contracts.js";
import type { BuildBrief, GeneratedCodeFile, SharedContractEntry } from "../types/generation.js";
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
        title: "Shared Contracts (cross-role interface agreements — MUST be respected)",
        lines: renderSharedContracts(args.buildBrief.sharedContracts, args.role),
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
        "Plan files in dependency order: shared contracts first, then server, then HTML, then JS/CSS. This ensures later files can reference earlier ones.",
        "Browser JS files must NEVER use process.env or Node.js APIs. API keys belong in server-side code only.",
        "Frontend files must call backend API endpoints (e.g. /api/weather) instead of calling external APIs directly.",
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
        title: "Shared Contracts (cross-role interface agreements — MUST be respected)",
        lines: renderSharedContracts(args.buildBrief.sharedContracts, args.role),
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
        "CRITICAL: If 'Relevant Existing File Contents' includes an HTML file, your JS must only reference element IDs and classes that actually exist in that HTML.",
        "CRITICAL: If 'Relevant Existing File Contents' includes a JS or server file, your HTML must include all DOM elements that the JS references via getElementById, querySelector, etc.",
        "Browser JS must NEVER use process.env, require(), or Node.js APIs. Use fetch('/api/...') to get data from the backend instead.",
        "API keys and secrets must ONLY be used in server-side code, never in browser-facing files.",
        "Frontend files (public/) must call backend API endpoints (e.g. fetch('/api/weather')) instead of calling external APIs directly.",
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
        title: "Shared Contracts (cross-role interface agreements — MUST be respected)",
        lines: renderSharedContracts(args.buildBrief.sharedContracts, args.role),
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
        title: "Shared Contracts (cross-role interface agreements — MUST be respected)",
        lines: renderSharedContracts(args.buildBrief.sharedContracts, args.role),
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
        "CRITICAL: HTML element IDs/classes must match what the JS code references. JS must only query elements that exist in the HTML.",
        "Browser JS must NEVER use process.env, require(), or Node.js APIs.",
        "Frontend files must call backend API endpoints instead of calling external APIs directly.",
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
      "Produce a distinctive, production-grade UI that feels genuinely designed for the product context — never generic or template-like.",
      "Keep the browser code dependency-free and directly compatible with the bootstrap payload.",
      "Prioritize mobile-first responsive design: use CSS Grid or Flexbox for layout, rem/em units, and media queries.",
      "Do not stop at showing lists or markdown-style summaries when the request expects an actual product surface.",

      // Design thinking — decide a bold aesthetic direction BEFORE coding
      "Before writing any CSS, commit to a clear aesthetic direction (e.g., brutally minimal, retro-futuristic, luxury/refined, editorial/magazine, playful/toy-like, art deco, industrial/utilitarian). Execute it with precision and consistency.",
      "Every design must have one UNFORGETTABLE visual detail — something a user will remember after closing the tab.",

      // Typography — the single biggest differentiator
      "NEVER use generic fonts (Inter, Roboto, Arial, system-ui, Segoe UI, or system sans-serif stacks). Import distinctive Google Fonts or CDN-hosted fonts. Pair a characterful display font with a refined body font.",
      "Vary font choices per project — never converge on the same font (e.g., Space Grotesk) across generations.",

      // Color & Theme
      "Commit to a cohesive, intentional color palette using CSS custom properties. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.",
      "NEVER default to purple gradients on white backgrounds or other cliché AI-generated color schemes. Choose colors that match the product context.",
      "Vary between light and dark themes across projects — do not always default to the same.",

      // Motion & Micro-interactions
      "Add CSS animations for high-impact moments: staggered page-load reveals (animation-delay), scroll-triggered effects, and hover states that surprise.",
      "Focus animation budget on one well-orchestrated entrance sequence rather than scattered micro-interactions.",
      "Use CSS @keyframes and transitions (0.2s-0.6s, cubic-bezier easing) for smooth, intentional motion.",

      // Spatial composition & Layout
      "Use unexpected layouts: asymmetry, overlap, diagonal flow, grid-breaking hero elements, generous negative space OR controlled density. Avoid predictable card grids.",

      // Backgrounds & Visual texture
      "Create atmosphere with layered backgrounds: gradient meshes, noise/grain textures, geometric patterns, layered transparencies, dramatic shadows, or decorative borders. Never default to flat solid colors.",

      // Spacing & System
      "Apply consistent spacing via CSS custom properties (--spacing-sm, --spacing-md, --spacing-lg) for padding and margins.",
      "Use border-radius, box-shadow with intentional values to reinforce the chosen aesthetic.",

      // UX quality
      "Show loading states (skeleton screens or spinners) while data is being fetched.",
      "Show user-friendly error messages with retry options when API calls fail.",
      "Ensure all interactive elements have visible hover/active/focus states.",
      "The first screen must immediately show the core product experience, not a blank page waiting for data.",
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

function renderSharedContracts(contracts: BuildBrief["sharedContracts"], role: CodingRole): string[] {
  if (!contracts || contracts.length === 0) {
    return ["- none"];
  }
  // Show all contracts but highlight ones where this role is owner or consumer
  return contracts.flatMap((c) => {
    const isOwner = c.owner === role;
    const isConsumer = c.consumers.includes(role);
    const marker = isOwner ? " [YOU OWN THIS]" : isConsumer ? " [YOU CONSUME THIS]" : "";
    return [
      `- ${c.kind}: ${c.signature}${marker}`,
      `  owner: ${c.owner}`,
      `  consumers: ${c.consumers.join(", ")}`,
      `  payload: ${c.payload}`,
    ];
  });
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
