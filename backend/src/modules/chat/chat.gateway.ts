import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ProvidersService } from '../providers/providers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AIProvider, ChatMessage, ModelInfo } from '../../common/interfaces/ai-provider.interface';

interface StreamMessage {
  sessionId: string;
  provider: string;
  model: string;
  content: string;
  mode?: 'single' | 'multi';
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private providersService: ProvidersService,
    private prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.data.userId = userId;
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  @SubscribeMessage('chat:stream')
  async handleStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StreamMessage,
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      // Save user message
      await this.prisma.chatMessage.create({
        data: {
          sessionId: data.sessionId,
          role: 'user',
          content: data.content,
          model: data.model,
        },
      });

      // Get chat history
      const history = await this.prisma.chatMessage.findMany({
        where: { sessionId: data.sessionId },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      const messages = history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Stream response
      const provider = this.providersService.getProvider(data.provider);
      if (!provider) throw new Error(`Unknown provider: ${data.provider}`);

      const apiKey = await this.providersService.getUserApiKey(userId, data.provider);

      const stream = provider.streamChatCompletion(
        { messages, model: data.model, stream: true },
        apiKey || undefined,
      );

      let fullContent = '';

      for await (const chunk of stream) {
        if (chunk.done) break;
        fullContent += chunk.content;
        client.emit('chat:chunk', {
          sessionId: data.sessionId,
          content: chunk.content,
          done: false,
        });
      }

      // Save assistant message
      await this.prisma.chatMessage.create({
        data: {
          sessionId: data.sessionId,
          role: 'assistant',
          content: fullContent,
          model: data.model,
        },
      });

      client.emit('chat:chunk', {
        sessionId: data.sessionId,
        content: '',
        done: true,
      });

      // Auto-title: if session is still "New Chat", generate a title from the first user message
      const session = await this.prisma.chatSession.findUnique({ where: { id: data.sessionId } });
      if (session && session.title === 'New Chat' && data.content) {
        this.generateAndSetTitle(client, data.sessionId, data.content, provider, apiKey || undefined).catch(() => {});
      }
    } catch (error: any) {
      client.emit('chat:error', {
        sessionId: data.sessionId,
        error: error.message || 'Stream error',
      });
    }
  }

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StreamMessage,
  ) {
    return this.handleStream(client, data);
  }

  @SubscribeMessage('session:create')
  async handleCreateSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { title?: string; model?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        title: data.title || 'New Chat',
        model: data.model || 'openrouter/auto',
      },
    });

    client.emit('session:created', session);
    return session;
  }

  @SubscribeMessage('session:list')
  async handleListSessions(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    client.emit('session:list', sessions);
  }

  @SubscribeMessage('session:messages')
  async handleGetMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId: data.sessionId },
      orderBy: { createdAt: 'asc' },
    });

    client.emit('session:messages', messages);
  }

  private async generateAndSetTitle(
    client: Socket,
    sessionId: string,
    firstMessage: string,
    provider: AIProvider,
    apiKey?: string,
  ) {
    const titlePrompt = `Generate a very short title (2-5 words) for a chat conversation that starts with this message. Return ONLY the title, no quotes or punctuation.\n\nMessage: "${firstMessage.slice(0, 200)}"`;

    try {
      // Pick fastest free model for title generation
      let titleModel = 'openrouter/auto';
      try {
        const userId = client.data.userId;
        if (userId) {
          const top = await this.providersService.getTopFreeModels(userId, 1);
          if (top.length > 0) titleModel = top[0].id;
        }
      } catch {}

      const result = await provider.chatCompletion(
        { messages: [{ role: 'user' as const, content: titlePrompt }], model: titleModel, stream: false },
        apiKey,
      );
      let title = result.content.trim().replace(/^["']|["']$/g, '').slice(0, 60);
      if (!title) title = this.fallbackTitle(firstMessage);

      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      });

      client.emit('session:updated', { id: sessionId, title });
    } catch {
      // Silent fallback
      const title = this.fallbackTitle(firstMessage);
      try {
        await this.prisma.chatSession.update({
          where: { id: sessionId },
          data: { title },
        });
        client.emit('session:updated', { id: sessionId, title });
      } catch {}
    }
  }

  private fallbackTitle(text: string): string {
    // Strip prefixes like [Search web for], [Think step by step]
    let cleaned = text.replace(/\[.*?\]\s*/g, '').trim();
    // Take first few words, limit to 40 chars
    const words = cleaned.split(/\s+/).slice(0, 5).join(' ');
    return words.slice(0, 40) || 'New Chat';
  }
}
