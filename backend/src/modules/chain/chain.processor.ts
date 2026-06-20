import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ChainService } from './chain.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChainExecutionContext, ChainStep, ChainStepResult } from '../../common/interfaces/chain.interface';

@Processor('chain-processing')
export class ChainProcessor extends WorkerHost {
  constructor(
    private chainService: ChainService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<{ context: ChainExecutionContext; steps: ChainStep[] }>): Promise<any> {
    const { context, steps } = job.data;
    const results: ChainStepResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const input = i === 0
        ? context.userMessage
        : results[results.length - 1].output;

      await job.updateProgress({ currentStep: i + 1, totalSteps: steps.length, stepId: step.id });

      const result = await this.chainService.processChainStep(
        step,
        input,
        context.userId,
        results,
      );

      results.push(result);
    }

    // Save final output to chat history
    const finalOutput = results[results.length - 1]?.output || '';
    await this.prisma.chatMessage.create({
      data: {
        sessionId: context.sessionId,
        role: 'assistant',
        content: this.formatChainOutput(results),
        model: 'chain',
        metadata: { results } as any,
      },
    });

    return { results, finalOutput };
  }

  private formatChainOutput(results: ChainStepResult[]): string {
    if (results.length === 1) return results[0].output;

    return results
      .map(
        (r, i) =>
          `**Step ${i + 1}: ${r.provider} (${r.task})**\n\n${r.output}\n`,
      )
      .join('\n---\n');
  }
}
