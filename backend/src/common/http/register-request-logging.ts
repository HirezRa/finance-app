import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { LogsService } from '../../modules/logs/logs.service';

type ReqWithLog = FastifyRequest & { _logStartMs?: number };

function shouldSkipPath(urlPath: string): boolean {
  if (urlPath === '/favicon.ico') {
    return true;
  }
  if (urlPath === '/api/v1/health' || urlPath.startsWith('/api/v1/health?')) {
    return true;
  }
  if (urlPath === '/health' || urlPath.startsWith('/health?')) {
    return true;
  }
  if (urlPath === '/api/v1/logs' || urlPath.startsWith('/api/v1/logs?')) {
    return true;
  }
  return false;
}

function identifySource(
  userAgent: string,
  headers: Record<string, unknown>,
): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('n8n') || headers['x-n8n-signature']) {
    return 'n8n';
  }
  const wh = headers['x-webhook-source'];
  if (typeof wh === 'string' && wh.trim()) {
    return `webhook:${wh.trim()}`;
  }
  if (ua.includes('axios') || ua.includes('node-fetch')) {
    return 'api-client';
  }
  if (ua.includes('mozilla') || ua.includes('chrome')) {
    return 'browser';
  }
  return 'unknown';
}

function maskIp(ip: string | undefined): string {
  if (!ip) return 'unknown';
  const v4 = ip.replace(/^::ffff:/, '');
  const parts = v4.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  return v4.length > 12 ? `${v4.slice(0, 10)}…` : v4;
}

/**
 * לוג בקשות/תשובות HTTP (Fastify). לא משתמש ב-Express middleware.
 */
export function registerRequestLogging(
  app: NestFastifyApplication,
  logs: LogsService,
): void {
  const fastify = app.getHttpAdapter().getInstance();

  fastify.addHook('onRequest', async (req: ReqWithLog) => {
    req._logStartMs = Date.now();
  });

  fastify.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawUrl = req.url || '/';
    const pathOnly = rawUrl.split('?')[0];
    if (shouldSkipPath(pathOnly)) {
      return;
    }

    const reqWith = req as ReqWithLog;
    const start = reqWith._logStartMs ?? Date.now();
    const durationMs = Date.now() - start;
    const method = req.method;
    const statusCode = reply.statusCode;
    const ua = String(req.headers['user-agent'] ?? 'unknown');
    const source = identifySource(ua, req.headers as Record<string, unknown>);
    const ip = maskIp(req.ip);

    logs.add('DEBUG', 'api', `← ${method} ${pathOnly}`, {
      source,
      ip,
      userAgent: ua.slice(0, 120),
    });

    const level =
      statusCode === 401
        ? 'DEBUG'
        : statusCode >= 400
          ? 'WARN'
          : 'DEBUG';
    logs.add(level, 'api', `→ ${method} ${pathOnly} ${statusCode}`, {
      source,
      statusCode,
      durationMs,
      ip,
    });
  });
}
