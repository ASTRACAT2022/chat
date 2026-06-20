import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChainService } from './chain.service';
import { ChainStep } from '../../common/interfaces/chain.interface';

@ApiTags('Chain Processing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chain')
export class ChainController {
  constructor(private chainService: ChainService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new processing chain' })
  createChain(
    @CurrentUser('id') userId: string,
    @Body('name') name: string,
    @Body('steps') steps: ChainStep[],
  ) {
    return this.chainService.createChain(userId, name, steps);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get user chains' })
  getUserChains(@CurrentUser('id') userId: string) {
    return this.chainService.getUserChains(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get chain by ID' })
  getChain(@Param('id') id: string) {
    return this.chainService.getChainById(id);
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute a chain' })
  executeChain(
    @CurrentUser('id') userId: string,
    @Body('chainId') chainId: string,
    @Body('sessionId') sessionId: string,
    @Body('message') message: string,
  ) {
    return this.chainService.executeChain({
      chainId,
      sessionId,
      userId,
      userMessage: message,
    });
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get chain execution status' })
  getStatus(@Param('jobId') jobId: string) {
    return this.chainService.getChainStatus(jobId);
  }
}
