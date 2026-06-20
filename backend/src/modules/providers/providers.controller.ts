import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProvidersService } from './providers.service';

@ApiTags('AI Providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProvidersController {
  constructor(private providersService: ProvidersService) {}

  @Get('models')
  @ApiOperation({ summary: 'Get available models for providers' })
  getModels(
    @CurrentUser('id') userId: string,
    @Query('provider') provider?: string,
  ) {
    return this.providersService.getAvailableModels(userId, provider);
  }

  @Get('models/free')
  @ApiOperation({ summary: 'Get free models from OpenRouter' })
  getFreeModels(@CurrentUser('id') userId: string) {
    return this.providersService.getFreeModels(userId);
  }

  @Post('chat/completion')
  @ApiOperation({ summary: 'Single model chat completion' })
  async chatCompletion(
    @CurrentUser('id') userId: string,
    @Body('provider') provider: string,
    @Body('model') model: string,
    @Body('messages') messages: { role: string; content: string }[],
    @Body('stream') stream?: boolean,
  ) {
    return this.providersService.chatCompletion(userId, provider, model, messages, stream);
  }
}
