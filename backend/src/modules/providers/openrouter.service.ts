import { Injectable } from '@nestjs/common';
import {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResponse,
  StreamChunk,
  ModelInfo,
} from '../../common/interfaces/ai-provider.interface';

@Injectable()
export class OpenRouterService implements AIProvider {
  readonly name = 'openrouter';
  readonly providerType = 'openrouter';

  private baseUrl = 'https://openrouter.ai/api/v1';
  private cacheTtl = 300_000;
  private modelsCache: { data: ModelInfo[]; expiry: number } | null = null;
  private freeModelsCache: { data: ModelInfo[]; expiry: number } | null = null;

  private hardcodedFreeModels: ModelInfo[] = [
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash', provider: 'openrouter', isFree: true, contextLength: 1_048_576 },
    { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
    { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3', provider: 'openrouter', isFree: true, contextLength: 131_072 },
    { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', provider: 'openrouter', isFree: true, contextLength: 131_072 },
    { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini 128K', provider: 'openrouter', isFree: true, contextLength: 131_072 },
    { id: 'mistralai/mistral-small-24b-instruct-2501:free', name: 'Mistral Small 24B', provider: 'openrouter', isFree: true, contextLength: 32_768 },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'openrouter', isFree: true, contextLength: 1_048_576 },
    { id: 'openrouter/auto', name: 'Auto (best model)', provider: 'openrouter', isFree: false },
  ];

  // Models known to return 404 "No endpoints found" — filtered out from listings
  private knownBrokenModels = new Set([
    'mistralai/mistral-7b-instruct:free',
    'cognitivecomputations/dolphin-mixtral-8x22b:free',
  ]);

  private async getHeaders(apiKey: string): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ai-hub-platform.com',
      'X-Title': 'AI Hub Platform',
    };
  }

  private isModelFree(model: any): boolean {
    if (model.id?.endsWith(':free')) return true;
    const pricing = model.pricing;
    if (!pricing) return false;
    const promptPrice = parseFloat(pricing.prompt);
    const completionPrice = parseFloat(pricing.completion);
    return promptPrice === 0 && completionPrice === 0;
  }

  async chatCompletion(
    options: ChatCompletionOptions,
    apiKey?: string,
  ): Promise<ChatCompletionResponse> {
    const key = apiKey || process.env.OPENROUTER_API_KEY || '';

    const MAX_RETRIES = 5;
    const failedModels = new Set<string>();
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: await this.getHeaders(key),
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const choice = data.choices?.[0];
        return {
          id: data.id,
          content: choice?.message?.content || '',
          model: data.model,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
        };
      }

      if (response.status === 429 || response.status === 404) {
        const errorText = await response.text();
        failedModels.add(options.model);

        let retryAfter = response.status === 429 ? 30 : 5;
        try {
          const errJson = JSON.parse(errorText);
          retryAfter =
            errJson?.error?.metadata?.retry_after_seconds ||
            errJson?.error?.retry_after_seconds ||
            retryAfter;
        } catch {}

        if (attempt < MAX_RETRIES) {
          const fallbackModel = this.getFallbackModel(failedModels);
          if (fallbackModel) options.model = fallbackModel;
          await new Promise(r => setTimeout(r, Math.min(retryAfter, 120) * 1000));
          continue;
        }
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    throw new Error('OpenRouter API error: max retries exceeded');
  }

  async *streamChatCompletion(
    options: ChatCompletionOptions,
    apiKey?: string,
  ): AsyncGenerator<StreamChunk> {
    const key = apiKey || process.env.OPENROUTER_API_KEY || '';
    const MAX_RETRIES = 3;
    const failedModels = new Set<string>();

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        let response;
        try {
          response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: await this.getHeaders(key),
            body: JSON.stringify({
              model: options.model,
              messages: options.messages,
              temperature: options.temperature ?? 0.7,
              max_tokens: options.maxTokens ?? 4096,
              stream: true,
            }),
            signal: AbortSignal.timeout(60000),
          });
        } catch (err: any) {
          throw new Error(`Network error: ${err.message}`);
        }

      if (response.ok) {
        try {
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
              if (data === '[DONE]') {
                yield { content: '', done: true };
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  yield { content: delta, done: false, model: parsed.model };
                }
              } catch {}
            }
          }

          yield { content: '', done: true };
          return;
        } finally {
          // body fully consumed — no cleanup needed
        }
      }

        // Handle rate limiting (429) and model not found (404)
        if (response.status === 429 || response.status === 404) {
          const errorText = await response.text();
          failedModels.add(options.model);

          let retryAfter = response.status === 429 ? 5 : 5;
          try {
            const errJson = JSON.parse(errorText);
            retryAfter = errJson?.error?.metadata?.retry_after_seconds || errJson?.error?.retry_after_seconds || retryAfter;
          } catch {}

          if (attempt < MAX_RETRIES) {
            const fallbackModel = this.getFallbackModel(failedModels);
            if (fallbackModel) {
              options.model = fallbackModel;
            }
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            continue;
          }
          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }

        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      } catch (err: any) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }
  }

  private getFallbackModel(failedModels: Set<string>): string | null {
    const candidates = this.hardcodedFreeModels
      .filter(m => m.isFree && !failedModels.has(m.id));
    if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)].id;
    // Last resort: try openrouter/auto which routes automatically
    if (!failedModels.has('openrouter/auto')) return 'openrouter/auto';
    return null;
  }

  private isCacheValid(cache: { data: ModelInfo[]; expiry: number } | null): boolean {
    return cache !== null && Date.now() < cache.expiry;
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    if (this.isCacheValid(this.modelsCache)) {
      return this.modelsCache!.data;
    }

    const key = apiKey || process.env.OPENROUTER_API_KEY || '';

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: await this.getHeaders(key),
      });

      if (!response.ok) return this.hardcodedFreeModels;

      const data = await response.json();

      if (!data?.data?.length) return this.hardcodedFreeModels;

      const models: ModelInfo[] = data.data
        .filter((m: any) => {
          if (this.knownBrokenModels.has(m.id)) return false;
          const endpoints = m.endpoints;
          if (Array.isArray(endpoints) && endpoints.length === 0) return false;
          if (endpoints && typeof endpoints === 'object' && Object.keys(endpoints).length === 0) return false;
          return true;
        })
        .map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: 'openrouter',
        isFree: this.isModelFree(m),
        contextLength: m.context_length || undefined,
        pricing: m.pricing
          ? {
              prompt: parseFloat(m.pricing.prompt || '0'),
              completion: parseFloat(m.pricing.completion || '0'),
            }
          : undefined,
        capabilities: m.architecture?.modality
          ? [...m.architecture.modality]
          : undefined,
      }));

      this.modelsCache = { data: models, expiry: Date.now() + this.cacheTtl };
      return models;
    } catch {
      return this.hardcodedFreeModels;
    }
  }

  async listFreeModels(apiKey?: string): Promise<ModelInfo[]> {
    if (this.isCacheValid(this.freeModelsCache)) {
      return this.freeModelsCache!.data;
    }

    const all = await this.listModels(apiKey);
    const free = all.filter((m) => m.isFree);
    this.freeModelsCache = { data: free, expiry: Date.now() + this.cacheTtl };
    return free;
  }

  private modelRecencyScore(id: string): number {
    const patterns: [RegExp, number][] = [
      [/25(0[1-9]|1[0-2])/, 100], [/24(0[1-9]|1[0-2])/, 60],
      [/23(0[1-9]|1[0-2])/, 20], [/22(0[1-9]|1[0-2])/, 0],
    ];
    for (const [re, score] of patterns) {
      if (re.test(id)) return score;
    }
    // Score by known model capabilities
    if (id.includes('deepseek') || id.includes('gemini-2.5') || id.includes('claude-3.5') || id.includes('gpt-4o')) return 90;
    if (id.includes('gemini-2.0') || id.includes('qwen-2.5') || id.includes('llama-3.3') || id.includes('llama-3.1')) return 80;
    if (id.includes('mistral-large') || id.includes('llama-3.2') || id.includes('phi-3') || id.includes('dbrx')) return 50;
    if (id.includes('gemma') || id.includes('mistral-7b') || id.includes('mixtral')) return 30;
    return 10;
  }

  async getTopFreeModels(apiKey?: string, count = 4): Promise<ModelInfo[]> {
    const all = await this.listFreeModels(apiKey);
    const scored = all
      .map((m) => ({ ...m, score: this.modelRecencyScore(m.id) + (m.contextLength || 0) / 100000 }))
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, count);
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/key`, {
        headers: await this.getHeaders(apiKey),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
