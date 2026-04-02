import type { ChatMessage } from "../types/chat.js";
import type { OrchestrationResult } from "../types/orchestration.js";

export function printExecutionReport(result: OrchestrationResult): void {
  process.stdout.write("=== 멀티 에이전트 토론 ===\n");
  for (const message of result.transcript) {
    printChatMessage(message);
  }

  process.stdout.write("\n=== PM 최종 결정 ===\n");
  process.stdout.write(`${result.discussion.pmFinal.finalDecision}\n`);

  process.stdout.write("\n=== 생성된 파일 ===\n");
  for (const artifact of result.artifacts) {
    process.stdout.write(`- ${artifact.filename}: ${artifact.absolutePath}\n`);
  }
}

function printChatMessage(message: ChatMessage): void {
  process.stdout.write(`\n[${message.id}] turn=${message.turn} ${message.speaker} (${message.role})\n`);
  process.stdout.write(`${indentMultiline(message.content)}\n`);
}

function indentMultiline(value: string): string {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
