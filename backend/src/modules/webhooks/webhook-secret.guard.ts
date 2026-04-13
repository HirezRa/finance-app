import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * אם מוגדר N8N_WEBHOOK_SECRET — דורש כותרת תואמת (אופציונלי לפרודקשן).
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.N8N_WEBHOOK_SECRET?.trim();
    if (!expected) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const h =
      req.headers['x-n8n-webhook-secret'] ??
      req.headers['x-webhook-secret'];
    const val = Array.isArray(h) ? h[0] : h;
    if (val !== expected) {
      throw new UnauthorizedException('webhook secret לא תקין');
    }
    return true;
  }
}
