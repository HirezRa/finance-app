export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogCategory =
  | 'sync'
  | 'account'
  | 'auth'
  | 'scraper'
  | 'ollama'
  | 'system';

export interface AppLogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
}
