import type { ChatMessage } from "../types/chat.js";
import type { AIDiscussion, PMFinalDecision } from "../types/contracts.js";
import { renderDiscussionContext } from "./shared.js";

export function buildAIDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the AI Specialist in a structured multi-agent collaboration room.",
      "Your job is to suggest AI features, evaluate feasibility, and identify risk.",
      "Read all prior messages before responding.",
      "Return valid JSON only and cite referenced message IDs.",
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "headline": "short AI angle title",',
      '  "summary": "one concise AI summary",',
      '  "aiFeatures": ["feature 1", "feature 2", "feature 3"],',
      '  "feasibility": ["feasibility note 1", "note 2"],',
      '  "risks": ["risk 1", "risk 2"],',
      '  "references": ["msg-001", "msg-002"]',
      '}',
      "",
      "Constraints:",
      "- aiFeatures: 3 to 6 items",
      "- feasibility/risks: 2 to 5 items",
      "- references must point to transcript IDs you are responding to",
      "- keep suggestions practical for a qwen3-backed MVP",
    ].join("\n"),
  };
}

export function buildAIFeaturesSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  aiDiscussion: AIDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the AI Specialist generating the final AI implementation artifact.",
      "Align strictly with the PM final decision.",
      "Focus on feasible AI capabilities, guardrails, and integration points.",
      "Return valid JSON only.",
    ].join(" "),
    userPrompt: [
      `User request: ${args.userRequest}`,
      `PM final decision: ${args.finalDecision.finalDecision}`,
      `PM MVP scope: ${args.finalDecision.mvpScope.join("; ")}`,
      `AI discussion summary: ${args.aiDiscussion.summary}`,
      `AI features: ${args.aiDiscussion.aiFeatures.join("; ")}`,
      `AI feasibility: ${args.aiDiscussion.feasibility.join("; ")}`,
      `AI risks: ${args.aiDiscussion.risks.join("; ")}`,
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "overview": "one concise paragraph",',
      '  "features": ["feature 1", "feature 2", "feature 3"],',
      '  "feasibilityNotes": ["note 1", "note 2"],',
      '  "guardrails": ["guardrail 1", "guardrail 2"],',
      '  "implementationSteps": ["step 1", "step 2", "step 3"],',
      '  "exampleCode": {',
      '    "language": "ts",',
      '    "snippet": "code snippet"',
      "  }",
      '}',
      "",
      "Constraints:",
      "- features must be realistic for a single qwen3-backed MVP",
      "- guardrails must address reliability or safety issues",
      "- exampleCode must show AI integration, not generic UI code",
    ].join("\n"),
  };
}
