import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    return Buffer.from(key, 'hex');
  }

  encrypt(text: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedText: string): string {
    const key = this.getEncryptionKey();
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encrypted = parts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private toProviderEnum(provider: string): 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'OPENROUTER' {
    const map: Record<string, any> = {
      openai: 'OPENAI',
      anthropic: 'ANTHROPIC',
      google: 'GOOGLE',
      openrouter: 'OPENROUTER',
    };
    return map[provider.toLowerCase()] || 'OPENROUTER';
  }

  async saveApiKey(userId: string, provider: string, keyValue: string) {
    const encrypted = this.encrypt(keyValue);
    return this.prisma.apiKey.upsert({
      where: { userId_provider: { userId, provider: this.toProviderEnum(provider) } },
      update: { keyValue: encrypted },
      create: { userId, provider: this.toProviderEnum(provider), keyValue: encrypted },
    });
  }

  async getApiKey(userId: string, provider: string): Promise<string | null> {
    const record = await this.prisma.apiKey.findUnique({
      where: { userId_provider: { userId, provider: this.toProviderEnum(provider) } },
    });
    if (!record) return null;
    return this.decrypt(record.keyValue);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
