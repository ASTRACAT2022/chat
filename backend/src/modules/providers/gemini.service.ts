import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
} from '../../common/interfaces/ai-provider.interface';

@Injectable()
export class GeminiService implements AIProvider {
  readonly name = 'google';
  readonly providerType = 'google';
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async chatCompletion(options: ChatCompletionOptions, apiKey?: string): Promise<ChatCompletionResponse> {
    const key = apiKey || '';
    const model = options.model || 'gemini-pro';

    const contents = options.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      id: crypto.randomUUID(),
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model,
      usage: undefined,
    };
  }

  async *streamChatCompletion(options: ChatCompletionOptions, apiKey?: string): AsyncGenerator<StreamChunk> {
    const key = apiKey || '';
    const model = options.model || 'gemini-pro';

    const contents = options.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
      },
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

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
        try {
          const parsed = JSON.parse(data);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield { content: text, done: false };
        } catch {}
      }
    }
    yield { content: '', done: true };
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    const fallback: ModelInfo[] = [
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google', isFree: false },
      { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', provider: 'google', isFree: false },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google', isFree: false },
    ];
    try {
      const key = apiKey || '';
      const response = await fetch(`${this.baseUrl}/models?key=${key}&pageSize=100`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) return fallback;
      const data = await response.json();
      return data.models?.map((m: any) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName || m.name.replace('models/', ''),
        provider: 'google',
        isFree: false,
        contextLength: m.inputTokenLimit || undefined,
      })) || fallback;
    } catch {
      return fallback;
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models?key=${apiKey}&pageSize=1`);
      return response.ok;
    } catch { return false; }
  }
}
