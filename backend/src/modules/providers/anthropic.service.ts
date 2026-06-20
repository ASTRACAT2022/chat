import { Injectable } from '@nestjs/common';
import {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
} from '../../common/interfaces/ai-provider.interface';

@Injectable()
export class AnthropicService implements AIProvider {
  readonly name = 'anthropic';
  readonly providerType = 'anthropic';
  private baseUrl = 'https://api.anthropic.com/v1';

  private getHeaders(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async chatCompletion(options: ChatCompletionOptions, apiKey?: string): Promise<ChatCompletionResponse> {
    const key = apiKey || '';
    const headers = this.getHeaders(key);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.filter(m => m.role !== 'system'),
        system: options.messages.find(m => m.role === 'system')?.content,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      content: data.content?.[0]?.text || '',
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
    };
  }

  async *streamChatCompletion(options: ChatCompletionOptions, apiKey?: string): AsyncGenerator<StreamChunk> {
    const key = apiKey || '';
    const headers = this.getHeaders(key);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: options.messages.filter(m => m.role !== 'system'),
        system: options.messages.find(m => m.role === 'system')?.content,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);

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
          if (parsed.type === 'content_block_delta') {
            const text = parsed.delta?.text;
            if (text) yield { content: text, done: false };
          }
        } catch {}
      }
    }
    yield { content: '', done: true };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', isFree: false },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'anthropic', isFree: false },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', isFree: false },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', isFree: false },
    ];
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const headers = this.getHeaders(apiKey);
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: '.' }],
        }),
      });
      return response.ok || response.status === 400;
    } catch { return false; }
  }
}
