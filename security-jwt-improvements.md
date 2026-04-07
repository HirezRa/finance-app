# שיפורי אבטחה - מודול JWT Authentication

## הנחיות ל-Cursor

**בצע את כל השיפורים הבאים ברצף. אל תשאל שאלות - פשוט בצע.**

---

## 1. התקנת Dependencies

```bash
cd backend
npm install @nestjs/throttler ioredis otplib qrcode
npm install @types/qrcode -D
```

---

## 2. Token Blacklist Service

צור `backend/src/modules/auth/services/token-blacklist.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';

@Injectable()
export class TokenBlacklistService {
  private redis: Redis;
  private readonly PREFIX = 'blacklist:';
  private readonly USER_PREFIX = 'user_invalidated:';

  constructor(private config: ConfigService) {
    this.redis = new Redis(this.config.get('REDIS_URL') || 'redis://localhost:6379');
  }

  /**
   * הוספת token לרשימה שחורה
   */
  async blacklist(token: string, expiresInSeconds: number): Promise<void> {
    const hash = this.hashToken(token);
    await this.redis.setex(this.PREFIX + hash, expiresInSeconds, '1');
  }

  /**
   * בדיקה אם token ברשימה שחורה
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const result = await this.redis.get(this.PREFIX + hash);
    return result !== null;
  }

  /**
   * ביטול כל הטוקנים של משתמש (לאחר שינוי סיסמה / logout מכל המכשירים)
   */
  async invalidateAllUserTokens(userId: string): Promise<void> {
    await this.redis.set(this.USER_PREFIX + userId, Date.now().toString());
  }

  /**
   * קבלת זמן ביטול טוקנים של משתמש
   */
  async getUserTokensInvalidatedAt(userId: string): Promise<number | null> {
    const timestamp = await this.redis.get(this.USER_PREFIX + userId);
    return timestamp ? parseInt(timestamp, 10) : null;
  }

  /**
   * Hash של token לחיסכון בזיכרון
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex').slice(0, 32);
  }
}
```

---

## 3. Account Lockout Service

צור `backend/src/modules/auth/services/account-lockout.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AccountLockoutService {
  private redis: Redis;
  
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 900; // 15 דקות
  private readonly ATTEMPT_WINDOW = 900; // 15 דקות

  constructor(private config: ConfigService) {
    this.redis = new Redis(this.config.get('REDIS_URL') || 'redis://localhost:6379');
  }

  /**
   * בדיקה אם החשבון נעול
   */
  async isLocked(identifier: string): Promise<{ locked: boolean; remainingSeconds?: number }> {
    const lockKey = `lockout:${identifier}`;
    const ttl = await this.redis.ttl(lockKey);
    
    if (ttl > 0) {
      return { locked: true, remainingSeconds: ttl };
    }
    return { locked: false };
  }

  /**
   * בדיקה לפני login - זורק exception אם נעול
   */
  async checkLockout(identifier: string): Promise<void> {
    const { locked, remainingSeconds } = await this.isLocked(identifier);
    if (locked) {
      const minutes = Math.ceil(remainingSeconds! / 60);
      throw new UnauthorizedException(
        `החשבון נעול עקב ניסיונות כושלים רבים. נסה שוב בעוד ${minutes} דקות`
      );
    }
  }

  /**
   * רישום ניסיון כושל
   */
  async recordFailedAttempt(identifier: string): Promise<{ locked: boolean; attemptsRemaining: number }> {
    const attemptsKey = `attempts:${identifier}`;
    const lockKey = `lockout:${identifier}`;

    const attempts = await this.redis.incr(attemptsKey);
    
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, this.ATTEMPT_WINDOW);
    }

    if (attempts >= this.MAX_ATTEMPTS) {
      await this.redis.setex(lockKey, this.LOCKOUT_DURATION, '1');
      await this.redis.del(attemptsKey);
      return { locked: true, attemptsRemaining: 0 };
    }

    return { locked: false, attemptsRemaining: this.MAX_ATTEMPTS - attempts };
  }

  /**
   * איפוס ניסיונות לאחר login מוצלח
   */
  async resetAttempts(identifier: string): Promise<void> {
    await this.redis.del(`attempts:${identifier}`);
  }

  /**
   * קבלת מספר ניסיונות שנותרו
   */
  async getRemainingAttempts(identifier: string): Promise<number> {
    const attempts = await this.redis.get(`attempts:${identifier}`);
    return this.MAX_ATTEMPTS - (parseInt(attempts || '0', 10));
  }
}
```

---

## 4. Two-Factor Authentication Service

צור `backend/src/modules/auth/services/two-factor.service.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { randomBytes } from 'crypto';

@Injectable()
export class TwoFactorService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {
    // הגדרות TOTP
    authenticator.options = {
      digits: 6,
      step: 30, // 30 שניות
      window: 1, // מאפשר קוד אחד לפני/אחרי
    };
  }

  /**
   * יצירת Secret חדש ל-2FA
   */
  async generateSetup(userId: string): Promise<{ secret: string; qrCode: string; manualCode: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new BadRequestException('משתמש לא נמצא');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('אימות דו-שלבי כבר מופעל');
    }

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'FinanceApp', secret);
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    return {
      secret,
      qrCode,
      manualCode: secret,
    };
  }

  /**
   * הפעלת 2FA לאחר אימות קוד
   */
  async enable(userId: string, secret: string, token: string): Promise<string[]> {
    // אימות הקוד
    const isValid = authenticator.verify({ token, secret });
    
    if (!isValid) {
      throw new BadRequestException('קוד אימות שגוי');
    }

    // הצפנת הsecret
    const encrypted = this.encryption.encrypt(secret);

    // יצירת Recovery Codes
    const recoveryCodes = this.generateRecoveryCodes();
    const encryptedCodes = this.encryption.encrypt(JSON.stringify(recoveryCodes));

    // שמירה בDB
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

  /**
   * אימות קוד 2FA
   */
  async verify(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    // פענוח הsecret
    const secret = this.encryption.decrypt(
      user.twoFactorSecret,
      user.twoFactorSecretIv!,
      user.twoFactorSecretTag!,
    );

    return authenticator.verify({ token, secret });
  }

  /**
   * בדיקה אם 2FA מופעל למשתמש
   */
  async isEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return user?.twoFactorEnabled ?? false;
  }

  /**
   * שימוש ב-Recovery Code
   */
  async useRecoveryCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.recoveryCodes) {
      return false;
    }

    // פענוח
    const codesJson = this.encryption.decrypt(
      user.recoveryCodes,
      user.recoveryCodesIv!,
      user.recoveryCodesTag!,
    );
    const codes: string[] = JSON.parse(codesJson);

    // נרמול הקוד
    const normalizedCode = code.replace(/-/g, '').toUpperCase();
    const index = codes.findIndex(c => c.replace(/-/g, '').toUpperCase() === normalizedCode);

    if (index === -1) {
      return false;
    }

    // הסרת הקוד ששומש (חד פעמי)
    codes.splice(index, 1);

    // שמירה מחדש
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

  /**
   * כיבוי 2FA (דורש סיסמה)
   */
  async disable(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      throw new BadRequestException('משתמש לא נמצא');
    }

    // אימות סיסמה
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
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

  /**
   * קבלת מספר Recovery Codes שנותרו
   */
  async getRemainingRecoveryCodes(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || !user.recoveryCodes) {
      return 0;
    }

    const codesJson = this.encryption.decrypt(
      user.recoveryCodes,
      user.recoveryCodesIv!,
      user.recoveryCodesTag!,
    );
    const codes: string[] = JSON.parse(codesJson);
    return codes.length;
  }

  /**
   * יצירת Recovery Codes חדשים
   */
  private generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = randomBytes(5).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
    }
    return codes;
  }
}
```

---

## 5. Audit Service

צור `backend/src/common/audit/audit.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum AuditAction {
  // Auth
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGIN_BLOCKED = 'auth.login.blocked',
  LOGIN_2FA_REQUIRED = 'auth.login.2fa_required',
  LOGIN_2FA_SUCCESS = 'auth.login.2fa_success',
  LOGIN_2FA_FAILED = 'auth.login.2fa_failed',
  LOGOUT = 'auth.logout',
  LOGOUT_ALL = 'auth.logout_all',
  REGISTER = 'auth.register',
  
  // Password
  PASSWORD_CHANGED = 'auth.password.changed',
  PASSWORD_RESET_REQUESTED = 'auth.password.reset_requested',
  PASSWORD_RESET_COMPLETED = 'auth.password.reset_completed',
  
  // 2FA
  TWO_FACTOR_ENABLED = 'auth.2fa.enabled',
  TWO_FACTOR_DISABLED = 'auth.2fa.disabled',
  RECOVERY_CODE_USED = 'auth.2fa.recovery_used',
  RECOVERY_CODES_REGENERATED = 'auth.2fa.recovery_regenerated',
  
  // Tokens
  TOKEN_REFRESHED = 'auth.token.refreshed',
  TOKEN_REVOKED = 'auth.token.revoked',
  ALL_TOKENS_REVOKED = 'auth.token.all_revoked',
  
  // Sensitive Data
  BANK_CREDENTIALS_CREATED = 'data.bank.created',
  BANK_CREDENTIALS_UPDATED = 'data.bank.updated',
  BANK_CREDENTIALS_DELETED = 'data.bank.deleted',
  BANK_CREDENTIALS_ACCESSED = 'data.bank.accessed',
  
  // Settings
  SETTINGS_CHANGED = 'settings.changed',
  EMAIL_CHANGED = 'settings.email.changed',
}

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  email?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * רישום אירוע ללוג
   */
  async log(action: AuditAction, context: AuditContext): Promise<void> {
    const sanitized = this.sanitizeContext(context);

    await this.prisma.auditLog.create({
      data: {
        action,
        userId: sanitized.userId,
        ipAddress: sanitized.ipAddress,
        userAgent: sanitized.userAgent,
        newValue: sanitized.metadata,
      },
    });

    // התראה על פעולות רגישות
    if (this.isSensitiveAction(action)) {
      await this.handleSensitiveAction(action, sanitized);
    }
  }

  /**
   * קבלת לוגים של משתמש
   */
  async getUserLogs(userId: string, limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * קבלת ניסיונות login כושלים
   */
  async getFailedLoginAttempts(identifier: string, minutes = 15): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    return this.prisma.auditLog.count({
      where: {
        action: AuditAction.LOGIN_FAILED,
        createdAt: { gte: since },
        OR: [
          { ipAddress: identifier },
          { newValue: { path: ['email'], equals: identifier } },
        ],
      },
    });
  }

  /**
   * ניקוי מידע רגיש
   */
  private sanitizeContext(context: AuditContext): AuditContext {
    const sensitiveFields = ['password', 'token', 'secret', 'credentials', 'key'];
    
    if (!context.metadata) {
      return context;
    }

    const sanitizedMetadata = { ...context.metadata };
    
    for (const key of Object.keys(sanitizedMetadata)) {
      if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
        sanitizedMetadata[key] = '[REDACTED]';
      }
    }

    return { ...context, metadata: sanitizedMetadata };
  }

  /**
   * בדיקה אם פעולה רגישה
   */
  private isSensitiveAction(action: AuditAction): boolean {
    const sensitiveActions = [
      AuditAction.LOGIN_FAILED,
      AuditAction.LOGIN_BLOCKED,
      AuditAction.TWO_FACTOR_DISABLED,
      AuditAction.PASSWORD_CHANGED,
      AuditAction.ALL_TOKENS_REVOKED,
      AuditAction.BANK_CREDENTIALS_ACCESSED,
    ];
    return sensitiveActions.includes(action);
  }

  /**
   * טיפול בפעולה רגישה
   */
  private async handleSensitiveAction(action: AuditAction, context: AuditContext): Promise<void> {
    // לוג לקונסול (יכול להחליף בwebhook)
    console.warn(`[SECURITY ALERT] ${action}`, {
      userId: context.userId,
      ip: context.ipAddress,
      time: new Date().toISOString(),
    });

    // TODO: שליחת webhook / email
  }
}
```

צור `backend/src/common/audit/audit.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

---

## 6. עדכון JWT Strategy עם Blacklist

עדכן `backend/src/modules/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private blacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
      passReqToCallback: true, // חשוב! מאפשר גישה לrequest
    });
  }

  async validate(req: Request, payload: { sub: string; email: string; iat: number }) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    // בדיקה 1: Token ברשימה שחורה
    if (await this.blacklist.isBlacklisted(token!)) {
      throw new UnauthorizedException('Token revoked');
    }

    // בדיקה 2: כל הטוקנים של המשתמש בוטלו (שינוי סיסמה וכו')
    const invalidatedAt = await this.blacklist.getUserTokensInvalidatedAt(payload.sub);
    if (invalidatedAt && payload.iat * 1000 < invalidatedAt) {
      throw new UnauthorizedException('Session invalidated');
    }

    // בדיקה 3: המשתמש קיים
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        householdId: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
```

---

## 7. עדכון Auth Service

עדכן `backend/src/modules/auth/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { AccountLockoutService } from './services/account-lockout.service';
import { TwoFactorService } from './services/two-factor.service';
import { AuditService, AuditAction } from '../../common/audit/audit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private blacklist: TokenBlacklistService,
    private lockout: AccountLockoutService,
    private twoFactor: TwoFactorService,
    private audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ctx: AuthContext) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('אימייל קיים במערכת');
    }

    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash: hash },
    });

    await this.prisma.userSettings.create({ data: { userId: user.id } });

    // Audit
    await this.audit.log(AuditAction.REGISTER, {
      userId: user.id,
      email: user.email,
      ...ctx,
    });

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ctx: AuthContext) {
    const identifier = `${dto.email}:${ctx.ipAddress}`;

    // בדיקת נעילה
    await this.lockout.checkLockout(identifier);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      // רישום ניסיון כושל
      const result = await this.lockout.recordFailedAttempt(identifier);
      
      await this.audit.log(AuditAction.LOGIN_FAILED, {
        email: dto.email,
        ...ctx,
        metadata: { attemptsRemaining: result.attemptsRemaining },
      });

      if (result.locked) {
        throw new UnauthorizedException('יותר מדי ניסיונות כושלים. החשבון ננעל ל-15 דקות');
      }

      throw new UnauthorizedException(
        `אימייל או סיסמה שגויים. נותרו ${result.attemptsRemaining} ניסיונות`
      );
    }

    // איפוס ניסיונות כושלים
    await this.lockout.resetAttempts(identifier);

    // בדיקת 2FA
    if (user.twoFactorEnabled) {
      const tempToken = await this.jwt.signAsync(
        { sub: user.id, type: '2fa_pending' },
        { secret: this.config.get('JWT_SECRET'), expiresIn: '5m' }
      );

      await this.audit.log(AuditAction.LOGIN_2FA_REQUIRED, {
        userId: user.id,
        ...ctx,
      });

      return {
        requiresTwoFactor: true,
        tempToken,
      };
    }

    // Login מוצלח
    await this.audit.log(AuditAction.LOGIN_SUCCESS, {
      userId: user.id,
      ...ctx,
    });

    const tokens = await this.generateTokens(user.id, user.email);
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    };
  }

  async verifyTwoFactor(tempToken: string, code: string, ctx: AuthContext) {
    let payload: { sub: string; type: string };
    
    try {
      payload = await this.jwt.verifyAsync(tempToken, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token לא תקין או פג תוקף');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Token לא תקין');
    }

    // נסיון עם קוד TOTP
    let isValid = await this.twoFactor.verify(payload.sub, code);

    // אם נכשל, נסיון עם Recovery Code
    if (!isValid) {
      isValid = await this.twoFactor.useRecoveryCode(payload.sub, code);
      if (isValid) {
        await this.audit.log(AuditAction.RECOVERY_CODE_USED, {
          userId: payload.sub,
          ...ctx,
        });
      }
    }

    if (!isValid) {
      await this.audit.log(AuditAction.LOGIN_2FA_FAILED, {
        userId: payload.sub,
        ...ctx,
      });
      throw new UnauthorizedException('קוד אימות שגוי');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    
    await this.audit.log(AuditAction.LOGIN_2FA_SUCCESS, {
      userId: user!.id,
      ...ctx,
    });

    const tokens = await this.generateTokens(user!.id, user!.email);
    return {
      user: { id: user!.id, email: user!.email, name: user!.name, role: user!.role },
      ...tokens,
    };
  }

  async refresh(userId: string, email: string, oldToken: string, ctx: AuthContext) {
    // Blacklist של הtoken הישן
    await this.blacklist.blacklist(oldToken, 7 * 24 * 60 * 60); // 7 ימים

    await this.audit.log(AuditAction.TOKEN_REFRESHED, {
      userId,
      ...ctx,
    });

    return this.generateTokens(userId, email);
  }

  async logout(accessToken: string, refreshToken: string, userId: string, ctx: AuthContext) {
    // Blacklist של שני הטוקנים
    await this.blacklist.blacklist(accessToken, 15 * 60); // 15 דקות
    await this.blacklist.blacklist(refreshToken, 7 * 24 * 60 * 60); // 7 ימים

    await this.audit.log(AuditAction.LOGOUT, {
      userId,
      ...ctx,
    });
  }

  async logoutAll(userId: string, ctx: AuthContext) {
    // ביטול כל הטוקנים של המשתמש
    await this.blacklist.invalidateAllUserTokens(userId);

    await this.audit.log(AuditAction.LOGOUT_ALL, {
      userId,
      ...ctx,
    });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string, ctx: AuthContext) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || !(await bcrypt.compare(oldPassword, user.passwordHash))) {
      throw new BadRequestException('סיסמה נוכחית שגויה');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });

    // ביטול כל הטוקנים הקיימים
    await this.blacklist.invalidateAllUserTokens(userId);

    await this.audit.log(AuditAction.PASSWORD_CHANGED, {
      userId,
      ...ctx,
    });
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
```

---

## 8. עדכון Auth Controller

עדכן `backend/src/modules/auth/auth.controller.ts`:

```typescript
import { Controller, Post, Body, UseGuards, HttpCode, Res, Req, Get } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TwoFactorService } from './services/two-factor.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private twoFactor: TwoFactorService,
  ) {}

  private getContext(req: FastifyRequest) {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  private setCookie(res: FastifyReply, token: string) {
    res.setCookie('refreshToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 לשעה
  async register(
    @Body() dto: RegisterDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.register(dto, this.getContext(req));
    this.setCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 לדקה
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.login(dto, this.getContext(req));

    if ('requiresTwoFactor' in result) {
      return result;
    }

    this.setCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('login/2fa')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 לדקה
  async verify2FA(
    @Body() dto: { tempToken: string; code: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.verifyTwoFactor(dto.tempToken, dto.code, this.getContext(req));
    this.setCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(200)
  async refresh(
    @CurrentUser() user: { sub: string; email: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const oldToken = req.cookies.refreshToken;
    const tokens = await this.auth.refresh(user.sub, user.email, oldToken, this.getContext(req));
    this.setCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const accessToken = req.headers.authorization?.replace('Bearer ', '') || '';
    const refreshToken = req.cookies.refreshToken || '';
    
    await this.auth.logout(accessToken, refreshToken, userId, this.getContext(req));
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { message: 'התנתקת בהצלחה' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.auth.logoutAll(userId, this.getContext(req));
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { message: 'התנתקת מכל המכשירים' };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: { oldPassword: string; newPassword: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.auth.changePassword(userId, dto.oldPassword, dto.newPassword, this.getContext(req));
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { message: 'הסיסמה שונתה. יש להתחבר מחדש' };
  }

  // ============ 2FA Endpoints ============

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setup2FA(@CurrentUser('id') userId: string) {
    return this.twoFactor.generateSetup(userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2FA(
    @CurrentUser('id') userId: string,
    @Body() dto: { secret: string; token: string },
  ) {
    const recoveryCodes = await this.twoFactor.enable(userId, dto.secret, dto.token);
    return {
      message: 'אימות דו-שלבי הופעל',
      recoveryCodes, // להציג למשתמש פעם אחת בלבד!
    };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2FA(
    @CurrentUser('id') userId: string,
    @Body() dto: { password: string },
  ) {
    await this.twoFactor.disable(userId, dto.password);
    return { message: 'אימות דו-שלבי בוטל' };
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@CurrentUser('id') userId: string) {
    const enabled = await this.twoFactor.isEnabled(userId);
    const remainingCodes = enabled ? await this.twoFactor.getRemainingRecoveryCodes(userId) : 0;
    return { enabled, remainingRecoveryCodes: remainingCodes };
  }
}
```

---

## 9. עדכון Auth Module

עדכן `backend/src/modules/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { AccountLockoutService } from './services/account-lockout.service';
import { TwoFactorService } from './services/two-factor.service';
import { AuditModule } from '../../common/audit/audit.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'medium', ttl: 10000, limit: 30 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    TokenBlacklistService,
    AccountLockoutService,
    TwoFactorService,
  ],
  exports: [AuthService, TokenBlacklistService],
})
export class AuthModule {}
```

---

## 10. עדכון App Module

עדכן `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EncryptionModule,
    AuditModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

---

## סיכום השיפורים

| רכיב | מה נוסף |
|------|---------|
| **Token Blacklist** | ביטול טוקנים ב-Redis, תמיכה בביטול כל טוקני משתמש |
| **Account Lockout** | 5 ניסיונות, נעילה ל-15 דקות |
| **2FA (TOTP)** | Google Authenticator, 10 Recovery Codes |
| **Rate Limiting** | הגבלות על login, register, 2FA |
| **Audit Logging** | לוג מפורט של כל פעולות Auth |
| **Password Change** | ביטול אוטומטי של כל הטוקנים |
| **Logout All** | התנתקות מכל המכשירים |

**בצע את כל השינויים ברצף. אל תעצור עד שהכל עובד!**
