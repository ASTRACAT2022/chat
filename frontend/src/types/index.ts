export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  model: string;
  mode: 'single' | 'multi' | 'chain';
  chainId?: string;
  messages?: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChainStep {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'search';
  model?: string;
  task: 'reasoning' | 'web_search' | 'final_write' | 'custom';
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Chain {
  id: string;
  userId: string;
  name: string;
  steps: ChainStep[];
  createdAt: string;
  updatedAt: string;
}

export interface StreamChunk {
  sessionId: string;
  content: string;
  done: boolean;
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'openrouter';

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
