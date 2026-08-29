export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  message: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface AIService {
  chat(messages: AIMessage[]): Promise<AIResponse>;
}
