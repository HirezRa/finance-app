import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { CreateScraperConfigDto } from './dto/create-scraper-config.dto';

@Injectable()
export class ScraperConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateScraperConfigDto) {
    const encrypted = this.encryption.encrypt(JSON.stringify(dto.credentials));

    return this.prisma.scraperConfig.create({
      data: {
        userId,
        companyId: dto.companyId,
        companyDisplayName: dto.companyDisplayName,
        encryptedCredentials: encrypted.encryptedData,
        credentialsIv: encrypted.iv,
        credentialsAuthTag: encrypted.authTag,
      },
      select: {
        id: true,
        companyId: true,
        companyDisplayName: true,
        isActive: true,
        syncEnabled: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.scraperConfig.findMany({
      where: { userId },
      select: {
        id: true,
        companyId: true,
        companyDisplayName: true,
        isActive: true,
        syncEnabled: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastError: true,
        createdAt: true,
      },
    });
  }

  async getDecryptedConfig(configId: string, userId: string) {
    const config = await this.prisma.scraperConfig.findFirst({
      where: { id: configId, userId },
    });

    if (!config) {
      throw new NotFoundException('הגדרת סקרייפר לא נמצאה');
    }

    const credentials = JSON.parse(
      this.encryption.decrypt(
        config.encryptedCredentials,
        config.credentialsIv,
        config.credentialsAuthTag,
      ),
    ) as Record<string, unknown>;

    return { ...config, credentials };
  }

  async delete(configId: string, userId: string) {
    const config = await this.prisma.scraperConfig.findFirst({
      where: { id: configId, userId },
    });

    if (!config) {
      throw new NotFoundException('הגדרת סקרייפר לא נמצאה');
    }

    return this.prisma.scraperConfig.delete({
      where: { id: configId },
    });
  }

  async updateSyncStatus(configId: string, status: string, error?: string) {
    return this.prisma.scraperConfig.update({
      where: { id: configId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastError: error ?? null,
      },
    });
  }
}
