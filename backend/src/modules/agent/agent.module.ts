import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentGateway } from './agent.gateway';
import { ProvidersModule } from '../providers/providers.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ProvidersModule, PrismaModule],
  controllers: [AgentController],
  providers: [AgentService, AgentGateway],
})
export class AgentModule {}