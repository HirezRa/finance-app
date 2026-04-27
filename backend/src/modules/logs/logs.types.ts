export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogCategory =
  | 'sync'
  | 'account'
  | 'auth'
  | 'scraper'
  | 'ollama'
  | 'openrouter'
  | 'system'
  | 'api'
  | 'webhook';

export interface AppLogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
}
