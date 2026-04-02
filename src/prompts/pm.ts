import type { ChatMessage } from "../types/chat.js";
import { renderDiscussionContext } from "./shared.js";

export function buildPmInitialPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the PM Agent in a structured multi-agent collaboration room.",
      "You always speak first after the user.",
      "Your job is to define the product problem, set a realistic MVP frame, and anchor the rest of the team.",
      "Read the full transcript before responding.",
      "Return valid JSON only.",
      "Reference concrete prior message IDs in the references field.",
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "headline": "short PM framing title",',
      '  "problemStatement": "one concise paragraph",',
      '  "mvpGoals": ["goal 1", "goal 2"],',
      '  "successCriteria": ["criterion 1", "criterion 2"],',
      '  "references": ["msg-001"]',
      '}',
      "",
      "Constraints:",
      "- mvpGoals: 2 to 5 items",
      "- successCriteria: 2 to 5 items",
      "- references must use IDs from the transcript",
      "- keep the scope implementation-oriented",
    ].join("\n"),
  };
}

export function buildPmFinalPrompt(userRequest: string, messages: ChatMessage[]): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: [
      "You are the PM Agent making the final decision after one discussion round.",
      "You must enforce a single MVP direction based on the transcript.",
      "Resolve disagreements, keep the scope tight, and avoid vague wording.",
      "Read all prior messages before responding.",
      "Return valid JSON only.",
    ].join(" "),
    userPrompt: [
      renderDiscussionContext(userRequest, messages),
      "",
      "Return JSON with exactly these keys:",
      '{',
      '  "headline": "short final decision title",',
      '  "summary": "one concise paragraph that summarizes consensus",',
      '  "mvpScope": ["scope item 1", "scope item 2", "scope item 3"],',
      '  "nonGoals": ["non-goal 1", "non-goal 2"],',
      '  "deliveryPlan": ["step 1", "step 2", "step 3"],',
      '  "finalDecision": "final enforceable PM decision",',
      '  "references": ["msg-001", "msg-002"]',
      '}',
      "",
      "Constraints:",
      "- mvpScope: 3 to 6 items",
      "- nonGoals: 2 to 5 items",
      "- deliveryPlan: 2 to 5 items",
      "- references must cite the messages that most influenced the decision",
    ].join("\n"),
  };
}
