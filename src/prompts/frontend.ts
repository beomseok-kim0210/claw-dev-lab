import type { ChatMessage } from "../types/chat.js";
import type { FrontendDiscussion, PMFinalDecision } from "../types/contracts.js";
import { renderDiscussionContext } from "./shared.js";

export function buildFrontendDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the Frontend Agent in a structured multi-agent collaboration room.",
      "Your job is to define screens, component hierarchy, and usability choices.",
      "Read all prior messages before responding.",
      "Return valid JSON only and cite referenced message IDs.",
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "headline": "short frontend angle title",',
      '  "summary": "one concise frontend summary",',
      '  "screens": ["screen 1", "screen 2", "screen 3"],',
      '  "components": ["component 1", "component 2", "component 3"],',
      '  "usabilityNotes": ["note 1", "note 2"],',
      '  "references": ["msg-001", "msg-002"]',
      '}',
      "",
      "Constraints:",
      "- screens/components: 3 to 6 items",
      "- usabilityNotes: 2 to 5 items",
      "- references must point to transcript IDs you are responding to",
    ].join("\n"),
  };
}

export function buildFrontendSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  frontendDiscussion: FrontendDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the Frontend Agent generating the final frontend implementation artifact.",
      "Align strictly with the PM final decision.",
      "Focus on screen structure, component boundaries, and usability.",
      "Return valid JSON only.",
    ].join(" "),
    userPrompt: [
      `User request: ${args.userRequest}`,
      `PM final decision: ${args.finalDecision.finalDecision}`,
      `PM MVP scope: ${args.finalDecision.mvpScope.join("; ")}`,
      `Frontend discussion summary: ${args.frontendDiscussion.summary}`,
      `Frontend screens: ${args.frontendDiscussion.screens.join("; ")}`,
      `Frontend components: ${args.frontendDiscussion.components.join("; ")}`,
      `Frontend usability notes: ${args.frontendDiscussion.usabilityNotes.join("; ")}`,
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "overview": "one concise paragraph",',
      '  "screens": ["screen 1", "screen 2", "screen 3"],',
      '  "components": ["component 1", "component 2", "component 3"],',
      '  "usabilityChecklist": ["check 1", "check 2"],',
      '  "implementationSteps": ["step 1", "step 2", "step 3"],',
      '  "exampleCode": {',
      '    "language": "tsx",',
      '    "snippet": "code snippet"',
      "  }",
      '}',
      "",
      "Constraints:",
      "- exampleCode must show component structure",
      "- keep scope inside the PM MVP decision",
      "- prioritize clarity and usability over visual flourish",
    ].join("\n"),
  };
}
