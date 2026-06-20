import { Controller, Get, Post, Delete, Param, Res, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AgentService } from './agent.service';

@ApiTags('Agent')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agent')
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List all agent sessions' })
  listSessions(@CurrentUser('id') userId: string) {
    return this.agentService.listSessions(userId);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session details' })
  getSession(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.agentService.getSession(id, userId);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete agent session' })
  deleteSession(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.agentService.deleteSession(id, userId);
  }

  @Get('sessions/:id/download')
  @ApiOperation({ summary: 'Download project as zip' })
  async downloadSession(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    await this.agentService.downloadSession(id, userId, res);
  }

  @Get('sessions/:id/files')
  @ApiOperation({ summary: 'Get all files content for preview' })
  getSessionFiles(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.agentService.getSessionFiles(id, userId);
  }

  @Get('status/:id')
  @ApiOperation({ summary: 'Get live job status' })
  getStatus(@Param('id') id: string) {
    return this.agentService.getJob(id);
  }
}
