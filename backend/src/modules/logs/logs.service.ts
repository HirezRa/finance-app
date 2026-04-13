import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import type { AppLogEntry, LogCategory, LogLevel } from './logs.types';

const MAX_LOGS = 1000;

@Injectable()
export class LogsService implements OnModuleInit {
  private readonly logger = new Logger(LogsService.name);
  private entries: AppLogEntry[] = [];
  private readonly filePath: string;

  constructor() {
    const dir = join(process.cwd(), 'logs');
    this.filePath = join(dir, 'app-logs.jsonl');
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch {
      /* ignore */
    }
  }

  onModuleInit(): void {
    this.loadFromDisk();
    this.add('INFO', 'system', 'המערכת עלתה', {
      nodeEnv: process.env.NODE_ENV ?? 'development',
    });
  }

  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    try {
      const text = readFileSync(this.filePath, 'utf-8');
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const parsed: AppLogEntry[] = [];
      for (const line of lines.slice(-MAX_LOGS)) {
        try {
          parsed.push(JSON.parse(line) as AppLogEntry);
        } catch {
          /* skip bad line */
        }
      }
      this.entries = parsed.slice(-MAX_LOGS);
    } catch (e) {
      this.logger.warn('Failed to load app logs file', e);
    }
  }

  private persistAll(): void {
    try {
      const body =
        this.entries.map((e) => JSON.stringify(e)).join('\n') +
        (this.entries.length > 0 ? '\n' : '');
      writeFileSync(this.filePath, body, 'utf-8');
    } catch (e) {
      this.logger.warn('Failed to persist app logs', e);
    }
  }

  add(
    level: LogLevel,
    category: LogCategory,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: AppLogEntry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      level,
      category,
      message,
      meta,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_LOGS) {
      this.entries = this.entries.slice(-MAX_LOGS);
    }
    this.persistAll();
  }

  query(filters: {
    level?: LogLevel;
    category?: LogCategory;
    q?: string;
    limit?: number;
  }): AppLogEntry[] {
    let list = [...this.entries].reverse();
    if (filters.level) {
      list = list.filter((e) => e.level === filters.level);
    }
    if (filters.category) {
      list = list.filter((e) => e.category === filters.category);
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      list = list.filter((e) => {
        const inMsg = e.message.toLowerCase().includes(q);
        const inMeta =
          e.meta &&
          JSON.stringify(e.meta).toLowerCase().includes(q);
        return inMsg || Boolean(inMeta);
      });
    }
    const lim = Math.min(filters.limit ?? 200, MAX_LOGS);
    return list.slice(0, lim);
  }

  clear(): void {
    this.entries = [];
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
      }
    } catch {
      /* ignore */
    }
    this.add('INFO', 'system', 'יומן הלוגים נוקה');
  }
}
