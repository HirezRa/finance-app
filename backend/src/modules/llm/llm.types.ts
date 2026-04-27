/** Active integration: off, local Ollama, or OpenRouter */
export type LLMProviderType = 'none' | 'ollama' | 'openrouter';

/** Backend engines (subset of LLMProviderType) */
export type LLMEngineId = 'ollama' | 'openrouter';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMModel {
  id: string;
  name: string;
  contextLength?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

export interface LLMProviderStatus {
  provider: LLMEngineId;
  enabled: boolean;
  connected: boolean;
  model: string;
  availableModels: LLMModel[];
  error?: string;
}

export interface LLMProvider {
  readonly type: LLMEngineId;
  isEnabled(): boolean;
  testConnection(): Promise<boolean>;
  getAvailableModels(): Promise<LLMModel[]>;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  getStatus(): Promise<LLMProviderStatus>;
}
