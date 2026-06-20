import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentService } from './agent.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class AgentGateway {
  @WebSocketServer()
  server: Server;

  constructor(private agentService: AgentService) {}

  @SubscribeMessage('agent:generate')
  async handleGenerate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { task: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.task) return;

    const job = await this.agentService.startGeneration(
      userId,
      data.task,
      (jobId, subTaskId, status, content) => {
        client.emit('agent:progress', { jobId, subTaskId, status, content });
      },
      (jobId, filePath, content) => {
        client.emit('agent:file', { jobId, filePath, content });
      },
    );

    client.emit('agent:started', { jobId: job.id, dbId: job.dbId });
  }

  @SubscribeMessage('agent:improve')
  async handleImprove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: string; instruction: string },
  ) {
    const userId = client.data.userId;
    if (!userId || !data?.jobId || !data?.instruction) return;

    try {
      await this.agentService.improveProject(
        data.jobId,
        data.instruction,
        (jobId, subTaskId, status, content) => {
          client.emit('agent:progress', { jobId, subTaskId, status, content });
        },
        (jobId, filePath, content) => {
          client.emit('agent:file', { jobId, filePath, content });
        },
      );
    } catch (err: any) {
      client.emit('agent:error', { error: err.message });
    }
  }

  @SubscribeMessage('agent:list')
  async handleList(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;
    const sessions = await this.agentService.listSessions(userId);
    client.emit('agent:list', sessions);
  }
}
