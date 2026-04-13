# AGENTS.md

## Project

**Claw Dev Multi-Agent Workspace** (v0.1.0)

Local LLM-based multi-agent orchestration system.
Users submit a product idea, then 6 agents (PM, Backend, Frontend, AI, Infra, Test) discuss, generate code, review, verify, and repair — all automated.

## Tech Stack

- TypeScript 5.9 (strict mode)
- Node.js >= 22
- ESM modules (NodeNext) — all relative imports use `.js` extensions
- Ollama (qwen3 default), Anthropic SDK, Google GenAI
- Zod 4 for all LLM output validation
- Ink (React CLI) + Vanilla HTML/JS/CSS (Web UI)
- No linter/formatter configured
- No dedicated test framework (workspace verifier handles generated code tests)

## Commands

```
npm run dev        # CLI entry point (tsx src/index.ts)
npm run web        # Web server (tsx src/server.ts)
npm run check      # TypeScript type check (tsc --noEmit)
npm run build      # Full compile (tsc -p tsconfig.json)
npm start          # Run compiled CLI (node dist/index.js)
npm run web:start  # Run compiled web server (node dist/server.js)
```

## Directory Structure

```
src/
  agents/          # 1 file per role, function-based (not class)
  prompts/         # 1 file per role, uses buildHarnessPrompt()
  orchestrator/    # Pipeline control, memory, verification, output
  types/           # Zod schemas and TypeScript types
  llm/             # OllamaClient, model profiles per stage
  harness/         # Shared prompt builder
  server/          # Session store, preview manager
  config.ts        # Env-based config loader
  index.ts         # CLI entry point
  server.ts        # Web server (SSE + REST)
public/            # Web UI (HTML/JS/CSS)
Leonxlnx-claude-code/  # Vendor launcher — DO NOT MODIFY
```

## Architecture

### Core Flow

MultiAgentOrchestrator (single class) controls the entire pipeline:

1. PM initial problem definition
2. Free discussion + reaction round (support / refine / challenge)
3. Clarification — only external inputs (API keys, credentials, approvals)
4. PM final decision
5. Role-specific spec generation (5 specs)
6. Implementation plan + Build Brief
7. Code generation + LLM review (max 2 rounds) + workspace verification + repair

### Key Patterns

- Agents are pure functions: input -> LLM call -> Zod-validated output
- Fallback functions are deterministic (no LLM call)
- Project memory persists to `<targetDir>/.multi-agent/project-memory.json`
- Generated code verification: `node --check`, `tsc --noEmit`, `node --test`
- Verification failures no longer crash the session — they produce warnings

### 6 Agent Roles

| Role | File | Does |
|------|------|------|
| PM | pmAgent.ts | Problem definition, final decision, review intervention |
| Backend | backendAgent.ts | Server, API, DB design and implementation |
| Frontend | frontendAgent.ts | UI/UX, components, screens |
| AI | aiAgent.ts | AI features, model integration, prompts |
| Infra | infraAgent.ts | Deploy, CI/CD, environment config |
| Test | testAgent.ts | Test strategy, test file generation |

## Key Files

| File | Why It Matters |
|------|---------------|
| `src/orchestrator/multiAgentOrchestrator.ts` | Main pipeline — largest file, highest risk |
| `src/orchestrator/workspaceVerifier.ts` | Generated code validation |
| `src/orchestrator/projectMemory.ts` | Stateful project continuation |
| `src/agents/codegenAgent.ts` | Code bundle generation per role |
| `src/agents/codeScaffolder.ts` | Deterministic code scaffolding fallback |
| `src/agents/codingAgent.ts` | Implementation updates, LLM code review |
| `src/harness/promptHarness.ts` | Shared prompt builder for all modes |
| `src/llm/modelProfiles.ts` | Per-model, per-stage parameter tuning |
| `src/types/contracts.ts` | All agent output Zod schemas |

## Rules

### Do

- Run `npm run check` before declaring any task complete
- Use existing patterns — agents are functions, not classes
- Use `.js` extensions in all relative imports
- Validate all LLM outputs with Zod schemas
- Keep diffs small and focused

### Do Not

- Edit `.env` files
- Modify anything in `Leonxlnx-claude-code/`
- Silently rename exported functions used across modules
- Change server routes, config schema, or Zod contracts without approval
- Delete files without asking
- Make speculative refactors or large rewrites

### Ask First If

- More than 3 files will change
- Architecture decisions are involved
- Changes touch the orchestrator core flow
- Changes affect Zod schemas in `src/types/contracts.ts`
- Changes affect the verification pipeline
- Requirements are ambiguous or conflicting
