import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtUser } from '../auth/jwt.strategy';
import { User } from '../users/user.decorator';

@Controller('users')
export class UsersController {
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@User() user: JwtUser): JwtUser {
    return user;
  }
}
