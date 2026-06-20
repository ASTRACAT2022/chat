export interface ChainStep {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'search';
  model?: string;
  task: 'reasoning' | 'web_search' | 'final_write' | 'custom';
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChainConfig {
  id: string;
  name: string;
  steps: ChainStep[];
}

export interface ChainExecutionContext {
  chainId: string;
  sessionId: string;
  userId: string;
  userMessage: string;
  history?: ChatMessage[];
}

export interface ChainStepResult {
  stepId: string;
  provider: string;
  task: string;
  input: string;
  output: string;
  latency: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

import { ChatMessage } from './ai-provider.interface';
