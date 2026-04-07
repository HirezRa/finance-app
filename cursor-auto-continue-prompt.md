# פרומפט להמשך אוטומטי - Cursor

## הנחיות חשובות

**המשך לבצע את כל השלבים ברצף עד לסיום מלא של האפליקציה.**

- לאחר כל שלב, עבור מיד לשלב הבא
- אל תשאל שאלות - פשוט בצע
- אם יש שגיאה - תקן והמשך
- ודא שכל קובץ נשמר ועובד

---

## Phase 1.2 - Prisma Schema + Seed

### 1. עדכן `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  USER
  VIEWER
}

enum TransactionStatus {
  COMPLETED
  PENDING
}

enum TransactionType {
  NORMAL
  INSTALLMENTS
}

enum AccountType {
  BANK
  CREDIT_CARD
}

model User {
  id                String    @id @default(uuid())
  email             String    @unique
  passwordHash      String
  name              String
  role              UserRole  @default(USER)
  
  twoFactorEnabled  Boolean   @default(false)
  twoFactorSecret   String?
  twoFactorSecretIv String?
  twoFactorSecretTag String?
  recoveryCodes     String?
  recoveryCodesIv   String?
  recoveryCodesTag  String?
  
  householdId       String?
  household         Household? @relation(fields: [householdId], references: [id])
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  accounts          Account[]
  categories        Category[]
  budgets           Budget[]
  scraperConfigs    ScraperConfig[]
  manualTransactions Transaction[] @relation("ManualTransactions")
  settings          UserSettings?
  
  @@index([householdId])
  @@index([email])
}

model Household {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  members   User[]
}

model UserSettings {
  id          String   @id @default(uuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  ollamaEnabled     Boolean?
  ollamaUrl         String?
  ollamaModel       String?
  
  n8nEnabled        Boolean?
  n8nWebhookUrl     String?
  n8nWebhookSecret  String?
  
  emailNotifications    Boolean @default(true)
  pushNotifications     Boolean @default(true)
  weeklyDigest          Boolean @default(true)
  
  defaultCurrency       String  @default("ILS")
  dateFormat            String  @default("DD/MM/YYYY")
  largeExpenseThreshold Decimal @default(500) @db.Decimal(15, 2)
  theme                 String  @default("system")
  language              String  @default("he")
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model SystemSettings {
  id          String   @id @default(uuid())
  
  ollamaEnabled     Boolean  @default(false)
  ollamaUrl         String?
  ollamaModel       String   @default("mistral")
  ollamaTimeout     Int      @default(30000)
  
  n8nEnabled        Boolean  @default(false)
  n8nWebhookUrl     String?
  n8nWebhookSecret  String?
  
  smtpEnabled       Boolean  @default(false)
  smtpHost          String?
  smtpPort          Int      @default(587)
  smtpUser          String?
  smtpPass          String?
  smtpFrom          String   @default("noreply@example.com")
  
  useFallbackRules  Boolean  @default(true)
  aiConfidenceThreshold Float @default(0.5)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Account {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  institutionId   String
  institutionName String
  accountNumber   String
  accountType     AccountType
  nickname        String?
  balance         Decimal?    @db.Decimal(15, 2)
  currency        String      @default("ILS")
  
  isActive        Boolean     @default(true)
  lastSyncAt      DateTime?
  lastSyncStatus  String?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  transactions    Transaction[]
  
  @@unique([userId, institutionId, accountNumber])
  @@index([userId])
}

model Transaction {
  id                String            @id @default(uuid())
  accountId         String
  account           Account           @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  categoryId        String?
  category          Category?         @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  
  type              TransactionType   @default(NORMAL)
  status            TransactionStatus @default(COMPLETED)
  date              DateTime          @db.Date
  processedDate     DateTime?         @db.Date
  
  amount            Decimal           @db.Decimal(15, 2)
  originalAmount    Decimal?          @db.Decimal(15, 2)
  originalCurrency  String            @default("ILS")
  
  description       String
  memo              String?
  
  installmentNumber Int?
  installmentTotal  Int?
  
  scraperIdentifier String?
  scraperHash       String?           @unique
  rawData           Json?
  
  isManual          Boolean           @default(false)
  createdByUserId   String?
  createdByUser     User?             @relation("ManualTransactions", fields: [createdByUserId], references: [id])
  
  notes             String?
  isExcludedFromCashFlow Boolean      @default(false)
  
  aiCategoryConfidence Float?
  aiCategorizedAt   DateTime?
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  @@index([accountId])
  @@index([categoryId])
  @@index([date])
}

model Category {
  id          String    @id @default(uuid())
  userId      String?
  user        User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name        String
  nameHe      String
  icon        String?
  color       String?
  
  parentId    String?
  parent      Category? @relation("SubCategories", fields: [parentId], references: [id])
  children    Category[] @relation("SubCategories")
  
  isSystem    Boolean   @default(false)
  isIncome    Boolean   @default(false)
  isFixed     Boolean   @default(false)
  isTracked   Boolean   @default(true)
  
  keywords    String[]
  sortOrder   Int       @default(0)
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  transactions    Transaction[]
  budgetCategories BudgetCategory[]
  
  @@unique([userId, name])
  @@index([userId])
  @@index([isSystem])
}

model Budget {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  month     Int
  year      Int
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  categories BudgetCategory[]
  
  @@unique([userId, month, year])
  @@index([userId])
}

model BudgetCategory {
  id          String   @id @default(uuid())
  budgetId    String
  budget      Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  amount      Decimal  @db.Decimal(15, 2)
  
  @@unique([budgetId, categoryId])
}

model ScraperConfig {
  id                    String   @id @default(uuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  companyId             String
  companyDisplayName    String
  
  encryptedCredentials  String   @db.Text
  credentialsIv         String
  credentialsAuthTag    String
  
  encryptedToken        String?  @db.Text
  tokenIv               String?
  tokenAuthTag          String?
  
  isActive              Boolean  @default(true)
  lastSyncAt            DateTime?
  lastSyncStatus        String?
  lastError             String?
  syncEnabled           Boolean  @default(true)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([userId, companyId])
  @@index([userId])
}

model WebhookConfig {
  id          String   @id @default(uuid())
  userId      String
  name        String
  url         String
  secret      String
  events      String[]
  isActive    Boolean  @default(true)
  lastTriggeredAt DateTime?
  lastStatus      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([userId])
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String
  entity    String?
  entityId  String?
  oldValue  Json?
  newValue  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

### 2. צור `backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_CATEGORIES = [
  { name: 'salary', nameHe: 'משכורת', icon: '💰', isIncome: true, isFixed: true },
  { name: 'bonus', nameHe: 'בונוס', icon: '🎁', isIncome: true },
  { name: 'refunds', nameHe: 'החזרים', icon: '↩️', isIncome: true },
  { name: 'other_income', nameHe: 'הכנסות אחרות', icon: '📈', isIncome: true },
  { name: 'rent', nameHe: 'שכירות', icon: '🏠', isFixed: true },
  { name: 'mortgage', nameHe: 'משכנתא', icon: '🏦', isFixed: true },
  { name: 'utilities', nameHe: 'חשבונות בית', icon: '💡', isFixed: true },
  { name: 'insurance', nameHe: 'ביטוחים', icon: '🛡️', isFixed: true },
  { name: 'subscriptions', nameHe: 'מנויים', icon: '📺', isFixed: true },
  { name: 'internet_phone', nameHe: 'אינטרנט וסלולר', icon: '📱', isFixed: true },
  { name: 'groceries', nameHe: 'סופר/מזון', icon: '🛒', isTracked: true, keywords: ['רמי לוי', 'שופרסל', 'מגה', 'ויקטורי'] },
  { name: 'restaurants', nameHe: 'מסעדות', icon: '🍽️', isTracked: true, keywords: ['מסעדה', 'קפה', 'פיצה'] },
  { name: 'fuel', nameHe: 'דלק', icon: '⛽', isTracked: true, keywords: ['דלק', 'סונול', 'פז'] },
  { name: 'transportation', nameHe: 'תחבורה', icon: '🚌', isTracked: true },
  { name: 'entertainment', nameHe: 'בילויים', icon: '🎬', isTracked: true },
  { name: 'shopping', nameHe: 'קניות', icon: '🛍️', isTracked: true },
  { name: 'health', nameHe: 'בריאות', icon: '🏥', isTracked: true },
  { name: 'pharmacy', nameHe: 'בית מרקחת', icon: '💊', isTracked: true },
  { name: 'travel', nameHe: 'נסיעות', icon: '✈️' },
  { name: 'bank_fees', nameHe: 'עמלות בנק', icon: '🏦' },
  { name: 'uncategorized', nameHe: 'לא מסווג', icon: '❓' },
];

async function main() {
  console.log('Seeding...');

  for (const cat of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_name: { userId: 'system', name: cat.name } },
      update: {},
      create: {
        name: cat.name,
        nameHe: cat.nameHe,
        icon: cat.icon,
        isSystem: true,
        isIncome: cat.isIncome || false,
        isFixed: cat.isFixed || false,
        isTracked: cat.isTracked ?? true,
        keywords: cat.keywords || [],
      },
    });
  }

  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 3. עדכן `backend/package.json` - הוסף:
```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

### 4. הרץ:
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

**המשך מיד ל-Phase 1.3**

---

## Phase 1.3 - Auth Module

צור את הקבצים הבאים:

### `backend/src/common/prisma/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### `backend/src/common/prisma/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

### `backend/src/common/encryption/encryption.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const masterKey = configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (!masterKey || masterKey.length !== 64) {
      throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex chars');
    }
    this.key = Buffer.from(masterKey, 'hex');
  }

  encrypt(text: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    let enc = cipher.update(text, 'utf8', 'hex');
    enc += cipher.final('hex');
    return {
      encryptedData: enc,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
    };
  }

  decrypt(data: string, iv: string, tag: string) {
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }
}
```

### `backend/src/common/encryption/encryption.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
```

### `backend/src/common/guards/jwt-auth.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### `backend/src/common/guards/jwt-refresh.guard.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
```

### `backend/src/common/decorators/current-user.decorator.ts`:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return data ? req.user?.[data] : req.user;
  },
);
```

### `backend/src/modules/auth/dto/register.dto.ts`:
```typescript
import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'אימייל לא תקין' })
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  password: string;
}
```

### `backend/src/modules/auth/dto/login.dto.ts`:
```typescript
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

### `backend/src/modules/auth/strategies/jwt.strategy.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

### `backend/src/modules/auth/strategies/jwt-refresh.strategy.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(req: any) => req?.cookies?.refreshToken]),
      secretOrKey: config.get('JWT_REFRESH_SECRET'),
    });
  }

  validate(payload: { sub: string; email: string }) {
    return payload;
  }
}
```

### `backend/src/modules/auth/auth.service.ts`:
```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('אימייל קיים');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash: hash },
    });

    await this.prisma.userSettings.create({ data: { userId: user.id } });

    const tokens = await this.tokens(user.id, user.email);
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('שגיאה בפרטים');
    }

    const tokens = await this.tokens(user.id, user.email);
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens };
  }

  async refresh(userId: string, email: string) {
    return this.tokens(userId, email);
  }

  private async tokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: this.config.get('JWT_SECRET'), expiresIn: '15m' }),
      this.jwt.signAsync(payload, { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '7d' }),
    ]);
    return { accessToken, refreshToken };
  }
}
```

### `backend/src/modules/auth/auth.controller.ts`:
```typescript
import { Controller, Post, Body, UseGuards, HttpCode, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.auth.register(dto);
    this.setCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: FastifyReply) {
    const result = await this.auth.login(dto);
    this.setCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(200)
  async refresh(@CurrentUser() user: any, @Res({ passthrough: true }) res: FastifyReply) {
    const tokens = await this.auth.refresh(user.sub, user.email);
    this.setCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { message: 'התנתקת' };
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
}
```

### `backend/src/modules/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### עדכן `backend/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EncryptionModule,
    AuthModule,
  ],
})
export class AppModule {}
```

### עדכן `backend/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import fastifyCookie from '@fastify/cookie';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true });

  await app.listen(3000, '0.0.0.0');
}
bootstrap();
```

### התקן:
```bash
npm install @fastify/cookie
```

**המשך ל-Phase 1.4 - Frontend Auth**

---

## Phase 1.4 - Frontend Auth

צור קבצים:

### `frontend/src/services/api.ts`:
```typescript
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      try {
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });
        useAuthStore.getState().setAccessToken(data.accessToken);
        err.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(err.config);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
```

### `frontend/src/store/auth.store.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: any;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: any, token: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    { name: 'auth', partialize: (s) => ({ user: s.user }) }
  )
);
```

### `frontend/src/hooks/useAuth.ts`:
```typescript
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

export function useAuth() {
  const nav = useNavigate();
  const { user, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();

  const login = useMutation({
    mutationFn: (d: { email: string; password: string }) => api.post('/auth/login', d).then(r => r.data),
    onSuccess: (d) => { setAuth(d.user, d.accessToken); nav('/dashboard'); },
  });

  const register = useMutation({
    mutationFn: (d: { email: string; name: string; password: string }) => api.post('/auth/register', d).then(r => r.data),
    onSuccess: (d) => { setAuth(d.user, d.accessToken); nav('/dashboard'); },
  });

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    storeLogout();
    nav('/login');
  };

  return { user, isAuthenticated, login: login.mutate, register: register.mutate, logout, isLoading: login.isPending || register.isPending };
}
```

### `frontend/src/pages/LoginPage.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <form onSubmit={(e) => { e.preventDefault(); login({ email, password }); }} className="w-full max-w-md bg-slate-800 rounded-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">התחברות</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל" className="w-full p-3 bg-slate-700 rounded text-white" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה" className="w-full p-3 bg-slate-700 rounded text-white" required />
        <button disabled={isLoading} className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50">
          {isLoading ? 'מתחבר...' : 'התחבר'}
        </button>
        <p className="text-center text-slate-400">אין חשבון? <Link to="/register" className="text-blue-400">הירשם</Link></p>
      </form>
    </div>
  );
}
```

### `frontend/src/pages/RegisterPage.tsx`:
```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <form onSubmit={(e) => { e.preventDefault(); register({ name, email, password }); }} className="w-full max-w-md bg-slate-800 rounded-lg p-8 space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">הרשמה</h1>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם" className="w-full p-3 bg-slate-700 rounded text-white" required />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="אימייל" className="w-full p-3 bg-slate-700 rounded text-white" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="סיסמה" className="w-full p-3 bg-slate-700 rounded text-white" required />
        <button disabled={isLoading} className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium disabled:opacity-50">
          {isLoading ? 'נרשם...' : 'הירשם'}
        </button>
        <p className="text-center text-slate-400">יש חשבון? <Link to="/login" className="text-blue-400">התחבר</Link></p>
      </form>
    </div>
  );
}
```

### `frontend/src/pages/DashboardPage.tsx`:
```tsx
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl text-white">שלום, {user?.name}</h1>
          <button onClick={logout} className="px-4 py-2 bg-red-600 rounded text-white">התנתק</button>
        </div>
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <p className="text-5xl font-bold text-green-400">₪0</p>
          <p className="text-slate-400 mt-2">נשאר להוציא</p>
        </div>
      </div>
    </div>
  );
}
```

### עדכן `frontend/src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

function Protected({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return isAuth ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}
```

### עדכן `frontend/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

### התקן:
```bash
npm install react-router-dom zustand
```

---

## Phase 1 הושלם!

**המשך עכשיו ל-Phase 2 (Scraper + Accounts + Transactions) לפי הפרומפט הראשי.**

**אל תעצור! המשך לבנות את כל המודולים עד לסיום מלא.**
