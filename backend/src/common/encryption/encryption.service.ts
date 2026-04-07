import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class EncryptionService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const hex = this.config.get<string>('ENCRYPTION_MASTER_KEY', '');
    if (!hex || hex.length !== 64) {
      throw new Error(
        'ENCRYPTION_MASTER_KEY must be set to 64 hex characters (32 bytes for AES-256-GCM)',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      encryptedData: enc.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  decrypt(encryptedData: string, ivB64: string, authTagB64: string): string {
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  }
}
