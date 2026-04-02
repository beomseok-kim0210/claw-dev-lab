import { AGENT_SPEAKERS, USER_SPEAKER, type AgentRole, type ChatMessage, type ChatRole } from "../types/chat.js";

export class ChatStateManager {
  private readonly messages: ChatMessage[] = [];
  private sequence = 1;

  addUserRequest(content: string): ChatMessage {
    return this.addUserMessage(content);
  }

  addUserMessage(content: string): ChatMessage {
    return this.addMessage({
      speaker: USER_SPEAKER,
      role: "user",
      content,
    });
  }

  addAgentMessage(role: AgentRole, content: string): ChatMessage {
    return this.addMessage({
      speaker: AGENT_SPEAKERS[role],
      role,
      content,
    });
  }

  getMessages(): ChatMessage[] {
    return this.messages.map((message) => ({ ...message }));
  }

  private addMessage(args: { speaker: string; role: ChatRole; content: string }): ChatMessage {
    const message: ChatMessage = {
      id: `msg-${String(this.sequence).padStart(3, "0")}`,
      speaker: args.speaker,
      role: args.role,
      content: args.content,
      turn: this.messages.length,
      timestamp: new Date().toISOString(),
    };

    this.messages.push(message);
    this.sequence += 1;
    return message;
  }
}
