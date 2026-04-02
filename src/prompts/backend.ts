import type { ChatMessage } from "../types/chat.js";
import type { BackendDiscussion, PMFinalDecision } from "../types/contracts.js";
import { renderDiscussionContext } from "./shared.js";

export function buildBackendDiscussionPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the Backend Agent in a structured multi-agent collaboration room.",
      "Your job is to define APIs, data model shape, and technical constraints.",
      "Read all prior messages before responding.",
      "Return valid JSON only and cite referenced message IDs.",
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "headline": "short backend angle title",',
      '  "summary": "one concise backend summary",',
      '  "apiDesign": ["endpoint or service idea 1", "idea 2", "idea 3"],',
      '  "dataModel": ["entity or table idea 1", "idea 2"],',
      '  "constraints": ["constraint 1", "constraint 2"],',
      '  "references": ["msg-001", "msg-002"]',
      '}',
      "",
      "Constraints:",
      "- apiDesign: 3 to 6 items",
      "- dataModel: 2 to 5 items",
      "- constraints: 2 to 5 items",
      "- references must point to transcript IDs you are responding to",
    ].join("\n"),
  };
}

export function buildBackendSpecPrompt(args: {
  userRequest: string;
  finalDecision: PMFinalDecision;
  backendDiscussion: BackendDiscussion;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the Backend Agent generating the final backend implementation artifact.",
      "Align strictly with the PM final decision.",
      "Provide concrete APIs, data structures, and implementation guidance.",
      "Return valid JSON only.",
    ].join(" "),
    userPrompt: [
      `User request: ${args.userRequest}`,
      `PM final decision: ${args.finalDecision.finalDecision}`,
      `PM MVP scope: ${args.finalDecision.mvpScope.join("; ")}`,
      `Backend discussion summary: ${args.backendDiscussion.summary}`,
      `Backend proposed APIs: ${args.backendDiscussion.apiDesign.join("; ")}`,
      `Backend data model notes: ${args.backendDiscussion.dataModel.join("; ")}`,
      `Backend constraints: ${args.backendDiscussion.constraints.join("; ")}`,
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "overview": "one concise paragraph",',
      '  "apiDesign": ["endpoint 1", "endpoint 2", "endpoint 3"],',
      '  "dataModel": ["schema item 1", "schema item 2", "schema item 3"],',
      '  "constraints": ["constraint 1", "constraint 2"],',
      '  "implementationSteps": ["step 1", "step 2", "step 3"],',
      '  "exampleCode": {',
      '    "language": "ts",',
      '    "snippet": "code snippet"',
      "  }",
      '}',
      "",
      "Constraints:",
      "- apiDesign/dataModel/implementationSteps must be concrete",
      "- exampleCode must be directly relevant to the proposed backend",
      "- do not add features outside the PM MVP scope",
    ].join("\n"),
  };
}
