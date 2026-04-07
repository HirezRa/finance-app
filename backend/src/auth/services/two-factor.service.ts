import { Injectable, BadRequestException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';

@Injectable()
export class TwoFactorService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {
    authenticator.options = { digits: 6, step: 30, window: 1 };
  }

  async generateSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('משתמש לא נמצא');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA כבר מופעל');
    }

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'FinanceApp', secret);
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    return { secret, qrCode, manualCode: secret };
  }

  async enable(
    userId: string,
    secret: string,
    token: string,
  ): Promise<string[]> {
    if (!authenticator.verify({ token, secret })) {
      throw new BadRequestException('קוד אימות שגוי');
    }

    const encrypted = this.encryption.encrypt(secret);
    const recoveryCodes = this.generateRecoveryCodes();
    const encryptedCodes = this.encryption.encrypt(JSON.stringify(recoveryCodes));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encrypted.encryptedData,
        twoFactorSecretIv: encrypted.iv,
        twoFactorSecretTag: encrypted.authTag,
        recoveryCodes: encryptedCodes.encryptedData,
        recoveryCodesIv: encryptedCodes.iv,
        recoveryCodesTag: encryptedCodes.authTag,
      },
    });

    return recoveryCodes;
  }

  async verify(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    const secret = this.encryption.decrypt(
      user.twoFactorSecret,
      user.twoFactorSecretIv!,
      user.twoFactorSecretTag!,
    );

    return authenticator.verify({ token, secret });
  }

  async useRecoveryCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.recoveryCodes) {
      return false;
    }

    const codesJson = this.encryption.decrypt(
      user.recoveryCodes,
      user.recoveryCodesIv!,
      user.recoveryCodesTag!,
    );
    const codes: string[] = JSON.parse(codesJson) as string[];

    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const index = codes.findIndex(
      (c) => c.replace(/-/g, '').toUpperCase() === normalizedCode,
    );

    if (index === -1) {
      return false;
    }

    codes.splice(index, 1);
    const encryptedCodes = this.encryption.encrypt(JSON.stringify(codes));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        recoveryCodes: encryptedCodes.encryptedData,
        recoveryCodesIv: encryptedCodes.iv,
        recoveryCodesTag: encryptedCodes.authTag,
      },
    });

    return true;
  }

  async disable(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('משתמש לא נמצא');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('סיסמה שגויה');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorSecretIv: null,
        twoFactorSecretTag: null,
        recoveryCodes: null,
        recoveryCodesIv: null,
        recoveryCodesTag: null,
      },
    });
  }

  async isEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return user?.twoFactorEnabled ?? false;
  }

  async getRemainingRecoveryCodes(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.recoveryCodes) {
      return 0;
    }

    const codesJson = this.encryption.decrypt(
      user.recoveryCodes,
      user.recoveryCodesIv!,
      user.recoveryCodesTag!,
    );
    return (JSON.parse(codesJson) as string[]).length;
  }

  private generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = randomBytes(5).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
    }
    return codes;
  }
}
