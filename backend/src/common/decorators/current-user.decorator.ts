import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../../auth/jwt.strategy';

/**
 * @CurrentUser('id') → user id string (alias for userId)
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtUser | 'id' | undefined,
    ctx: ExecutionContext,
  ): string | JwtUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    const u = req.user;
    if (!u) {
      throw new Error('CurrentUser used without authenticated user');
    }
    if (data === 'id') {
      return u.userId;
    }
    if (data === undefined) {
      return u;
    }
    return u[data];
  },
);
