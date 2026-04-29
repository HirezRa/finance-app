import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Enable2faDto } from './dto/enable-2fa.dto';
import { Disable2faDto } from './dto/disable-2fa.dto';
import { TwoFactorService } from './services/two-factor.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
@SkipThrottle()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshTokens(dto.refreshToken);
  }

  @Get('2fa/setup')
  @UseGuards(JwtAuthGuard)
  setup2FA(@CurrentUser('id') userId: string) {
    return this.twoFactorService.generateSetup(userId);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2FA(
    @CurrentUser('id') userId: string,
    @Body() dto: Enable2faDto,
  ) {
    const recoveryCodes = await this.twoFactorService.enable(
      userId,
      dto.secret,
      dto.token,
    );
    return { message: '2FA enabled', recoveryCodes };
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2FA(
    @CurrentUser('id') userId: string,
    @Body() dto: Disable2faDto,
  ) {
    await this.twoFactorService.disable(userId, dto.password);
    return { message: '2FA disabled' };
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  async get2FAStatus(@CurrentUser('id') userId: string) {
    const enabled = await this.twoFactorService.isEnabled(userId);
    const remainingCodes = enabled
      ? await this.twoFactorService.getRemainingRecoveryCodes(userId)
      : 0;
    return { enabled, remainingRecoveryCodes: remainingCodes };
  }
}
