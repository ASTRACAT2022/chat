import { Injectable } from '@nestjs/common';
import {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
} from '../../common/interfaces/ai-provider.interface';

@Injectable()
export class OpenAIService implements AIProvider {
  readonly name = 'openai';
  readonly providerType = 'openai';
  private baseUrl = 'https://api.openai.com/v1';

  private async getHeaders(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
  }

  async chatCompletion(options: ChatCompletionOptions, apiKey?: string): Promise<ChatCompletionResponse> {
    const key = apiKey || '';
    const headers = await this.getHeaders(key);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  async *streamChatCompletion(options: ChatCompletionOptions, apiKey?: string): AsyncGenerator<StreamChunk> {
    const key = apiKey || '';
    const headers = await this.getHeaders(key);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') { yield { content: '', done: true }; return; }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) yield { content: delta, done: false };
        } catch {}
      }
    }
    yield { content: '', done: true };
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    const fallback: ModelInfo[] = [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', isFree: false },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', isFree: false },
      { id: 'gpt-4', name: 'GPT-4', provider: 'openai', isFree: false },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', isFree: false },
    ];
    try {
      const headers = await this.getHeaders(apiKey || '');
      const response = await fetch(`${this.baseUrl}/models`, { headers });
      if (!response.ok) return fallback;
      const data = await response.json();
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: 'openai',
        isFree: m.id.includes('gpt-3.5'),
      }));
    } catch {
      return fallback;
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const headers = await this.getHeaders(apiKey);
      const response = await fetch(`${this.baseUrl}/models`, { headers });
      return response.ok;
    } catch { return false; }
  }
}
