import { Module } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProvidersController } from './providers.controller';
import { OpenRouterService } from './openrouter.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    OpenRouterService,
  ],
  exports: [ProvidersService, OpenRouterService],
})
export class ProvidersModule {}
