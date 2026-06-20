export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
  model?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  isFree: boolean;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
  capabilities?: string[];
}

export interface AIProvider {
  readonly name: string;
  readonly providerType: string;

  chatCompletion(options: ChatCompletionOptions, apiKey?: string): Promise<ChatCompletionResponse>;
  streamChatCompletion(options: ChatCompletionOptions, apiKey?: string): AsyncGenerator<StreamChunk>;
  listModels(apiKey?: string): Promise<ModelInfo[]>;
  validateApiKey(apiKey: string): Promise<boolean>;
}
