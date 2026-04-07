import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../auth/jwt.strategy';

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return req.user;
  },
);
