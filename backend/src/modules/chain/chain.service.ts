import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ProvidersService } from '../providers/providers.service';
import {
  ChainConfig,
  ChainStep,
  ChainExecutionContext,
  ChainStepResult,
} from '../../common/interfaces/chain.interface';

@Injectable()
export class ChainService {
  constructor(
    @InjectQueue('chain-processing') private chainQueue: Queue,
    private prisma: PrismaService,
    private providersService: ProvidersService,
  ) {}

  async createChain(userId: string, name: string, steps: ChainStep[]) {
    return this.prisma.chain.create({
      data: { userId, name, steps: JSON.parse(JSON.stringify(steps)) },
    });
  }

  async getUserChains(userId: string) {
    return this.prisma.chain.findMany({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getChainById(chainId: string) {
    return this.prisma.chain.findUnique({ where: { id: chainId } });
  }

  async executeChain(context: ChainExecutionContext) {
    const chain = await this.prisma.chain.findUnique({
      where: { id: context.chainId },
    });
    if (!chain) throw new Error('Chain not found');

    const steps = chain.steps as unknown as ChainStep[];

    // Enqueue chain processing job
    const job = await this.chainQueue.add('execute-chain', {
      context,
      steps,
    });

    return { jobId: job.id, chainId: context.chainId };
  }

  async processChainStep(
    step: ChainStep,
    input: string,
    userId: string,
    previousResults: ChainStepResult[],
  ): Promise<ChainStepResult> {
    const startTime = Date.now();

    if (step.task === 'web_search') {
      return this.handleWebSearch(step, input, startTime);
    }

    const messages = [
      ...(step.prompt
        ? [{ role: 'system' as const, content: step.prompt }]
        : []),
      {
        role: 'user' as const,
        content: this.buildStepPrompt(step, input, previousResults),
      },
    ];

    const response = await this.providersService.chatCompletion(
      userId,
      step.provider,
      step.model || this.getDefaultModel(step.provider),
      messages,
      false,
    );

    const latency = Date.now() - startTime;

    return {
      stepId: step.id,
      provider: step.provider,
      task: step.task,
      input,
      output: typeof response === 'object' && 'content' in response
        ? (response as any).content
        : String(response),
      latency,
      tokenUsage: (response as any)?.usage,
    };
  }

  private buildStepPrompt(
    step: ChainStep,
    input: string,
    previousResults: ChainStepResult[],
  ): string {
    let prompt = input;

    if (previousResults.length > 0) {
      const context = previousResults
        .map(r => `[${r.task} from ${r.provider}]:\n${r.output}`)
        .join('\n\n');
      prompt = `Previous steps context:\n${context}\n\nCurrent request:\n${input}`;
    }

    if (step.task === 'reasoning') {
      prompt = `Think through this step by step:\n\n${prompt}`;
    }

    return prompt;
  }

  private async handleWebSearch(
    step: ChainStep,
    query: string,
    startTime: number,
  ): Promise<ChainStepResult> {
    try {
      const searchUrl = process.env.SEARXNG_URL || 'https://searxng.instance/search';
      const response = await fetch(
        `${searchUrl}?q=${encodeURIComponent(query)}&format=json`,
      );
      const data = await response.json();
      const results = (data.results || []).slice(0, 5);

      const latency = Date.now() - startTime;
      return {
        stepId: step.id,
        provider: 'search',
        task: 'web_search',
        input: query,
        output: results
          .map((r: any) => `- [${r.title}](${r.url}): ${r.content}`)
          .join('\n'),
        latency,
      };
    } catch (error) {
      return {
        stepId: step.id,
        provider: 'search',
        task: 'web_search',
        input: query,
        output: 'Web search unavailable. Using existing knowledge.',
        latency: Date.now() - startTime,
      };
    }
  }

  private getDefaultModel(provider: string): string {
    const defaults: Record<string, string> = {
      openrouter: 'openrouter/auto',
      openai: 'gpt-4-turbo',
      anthropic: 'claude-3-sonnet-20240229',
      google: 'gemini-pro',
    };
    return defaults[provider] || 'openrouter/auto';
  }

  async getChainStatus(jobId: string) {
    const job = await this.chainQueue.getJob(jobId);
    if (!job) throw new Error('Job not found');
    return {
      jobId: job.id,
      status: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
    };
  }
}
