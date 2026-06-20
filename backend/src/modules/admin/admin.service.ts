import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async ensureAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
  }

  async getDashboard(userId: string) {
    await this.ensureAdmin(userId);

    const [userCount, sessionCount, messageCount, recentUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.chatSession.count(),
      this.prisma.chatMessage.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, username: true, email: true, role: true, isBanned: true, createdAt: true },
      }),
    ]);

    return {
      stats: { userCount, sessionCount, messageCount },
      recentUsers,
    };
  }

  async listUsers(userId: string) {
    await this.ensureAdmin(userId);

    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, email: true, role: true, isBanned: true, createdAt: true },
    });
  }

  async toggleBan(userId: string, targetUserId: string) {
    await this.ensureAdmin(userId);

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new Error('User not found');

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isBanned: !target.isBanned },
    });
  }

  async getTopModels(userId: string) {
    await this.ensureAdmin(userId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { role: 'assistant', model: { not: null } },
      select: { model: true },
    });

    const modelCount = new Map<string, number>();
    for (const msg of messages) {
      if (msg.model) {
        modelCount.set(msg.model, (modelCount.get(msg.model) || 0) + 1);
      }
    }

    return Array.from(modelCount.entries())
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }
}
