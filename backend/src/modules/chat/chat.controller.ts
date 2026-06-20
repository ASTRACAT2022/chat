import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private prisma: PrismaService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session' })
  createSession(
    @CurrentUser('id') userId: string,
    @Body('title') title?: string,
    @Body('model') model?: string,
  ) {
    return this.prisma.chatSession.create({
      data: { userId, title: title || 'New Chat', model: model || 'openrouter/auto' },
    });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List user chat sessions' })
  listSessions(@CurrentUser('id') userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session with messages' })
  getSession(@Param('id') id: string) {
    return this.prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete a chat session' })
  deleteSession(@Param('id') id: string) {
    return this.prisma.chatSession.delete({ where: { id } });
  }
}
