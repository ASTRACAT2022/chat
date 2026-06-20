import { Injectable } from '@nestjs/common';
import { AIProvider, ModelInfo } from '../../common/interfaces/ai-provider.interface';
import { OpenRouterService } from './openrouter.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ProvidersService {
  providers = new Map<string, AIProvider>();

  constructor(
    private openRouterService: OpenRouterService,
    private usersService: UsersService,
  ) {
    this.register(this.openRouterService);
  }

  private register(provider: AIProvider) {
    this.providers.set(provider.providerType, provider);
  }

  getProvider(providerType: string): AIProvider | undefined {
    return this.providers.get(providerType);
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  async chatCompletion(
    userId: string,
    providerType: string,
    model: string,
    messages: { role: string; content: string }[],
    stream = false,
  ) {
    const provider = this.getProvider(providerType);
    if (!provider) throw new Error(`Unknown provider: ${providerType}`);

    const apiKey = await this.usersService.getApiKey(userId, providerType);

    const typedMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    if (stream) {
      return provider.streamChatCompletion(
        { messages: typedMessages, model, stream: true },
        apiKey || undefined,
      );
    }

    return provider.chatCompletion(
      { messages: typedMessages, model },
      apiKey || undefined,
    );
  }

  async getUserApiKey(userId: string, providerType: string): Promise<string | null> {
    return this.usersService.getApiKey(userId, providerType);
  }

  async getAvailableModels(userId: string, providerType?: string): Promise<Record<string, ModelInfo[]>> {
    if (providerType) {
      const provider = this.getProvider(providerType);
      if (!provider) throw new Error(`Unknown provider: ${providerType}`);
      const apiKey = await this.usersService.getApiKey(userId, providerType);
      return { [providerType]: await provider.listModels(apiKey || undefined) };
    }

    const result: Record<string, ModelInfo[]> = {};
    for (const [type, provider] of this.providers) {
      const apiKey = await this.usersService.getApiKey(userId, type);
      result[type] = await provider.listModels(apiKey || undefined);
    }
    return result;
  }

  async getFreeModels(userId: string): Promise<ModelInfo[]> {
    const openRouterProvider = this.getProvider('openrouter') as OpenRouterService;
    if (openRouterProvider && 'listFreeModels' in openRouterProvider) {
      const apiKey = await this.usersService.getApiKey(userId, 'openrouter');
      return openRouterProvider.listFreeModels(apiKey || undefined);
    }
    const apiKey = await this.usersService.getApiKey(userId, 'openrouter');
    return (await this.getProvider('openrouter')!.listModels(apiKey || undefined)).filter(m => m.isFree);
  }

  async getTopFreeModels(userId: string, count = 4): Promise<ModelInfo[]> {
    const openRouterProvider = this.getProvider('openrouter') as OpenRouterService;
    const apiKey = await this.usersService.getApiKey(userId, 'openrouter');
    if (openRouterProvider && 'getTopFreeModels' in openRouterProvider) {
      return openRouterProvider.getTopFreeModels(apiKey || undefined, count);
    }
    const all = await this.getFreeModels(userId);
    return all.slice(0, count);
  }

  async getBestFreeModel(userId: string): Promise<string> {
    const top = await this.getTopFreeModels(userId, 1);
    return top[0]?.id || 'openrouter/auto';
  }
}
