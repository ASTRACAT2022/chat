import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChainService } from './chain.service';
import { ChainController } from './chain.controller';
import { ChainProcessor } from './chain.processor';
import { ProvidersModule } from '../providers/providers.module';
import { config } from '../../config';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'chain-processing',
      connection: {
        host: config.redis.host,
        port: config.redis.port,
      },
    }),
    ProvidersModule,
  ],
  controllers: [ChainController],
  providers: [ChainService, ChainProcessor],
  exports: [ChainService],
})
export class ChainModule {}
