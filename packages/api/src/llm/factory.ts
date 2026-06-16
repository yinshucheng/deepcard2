/**
 * LLM 工厂。移植自 deepcard2 Python factory.py，
 * 新增 moonshot(kimi) 厂商（系统当前默认 .env 用的就是 Moonshot）。
 */
import { OpenAICompatibleProvider, type ProviderConfig } from './provider';
import { LlmConfigurationError } from './errors';

export interface ProviderCatalogEntry {
  baseUrl: string;
  models: string[];
  defaultModel: string;
  description: string;
}

/** 内置厂商目录：base_url + 支持的 model 列表 + 默认 model */
export const PROVIDER_CATALOG: Record<string, ProviderCatalogEntry> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4-turbo-preview'],
    defaultModel: 'gpt-4o-mini',
    description: 'OpenAI 官方模型',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
    description: 'DeepSeek 模型',
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-7B-Instruct',
      'meta-llama/Llama-3.1-8B-Instruct',
    ],
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    description: 'SiliconFlow（推荐用于中文）',
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.5', 'moonshot-v1-8k', 'moonshot-v1-32k'],
    defaultModel: 'kimi-k2.5',
    description: 'Moonshot Kimi 模型',
  },
};

export function getSupportedProviders(): string[] {
  return Object.keys(PROVIDER_CATALOG);
}

export function getProviderCatalog(name: string): ProviderCatalogEntry {
  const entry = PROVIDER_CATALOG[name];
  if (!entry) {
    throw new LlmConfigurationError(`Unknown LLM provider: ${name}`);
  }
  return entry;
}

export interface CreateProviderInput {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/** 按 provider 名创建 provider 实例（model/baseUrl 缺省时取目录默认值） */
export function createProvider(input: CreateProviderInput): OpenAICompatibleProvider {
  const catalog = getProviderCatalog(input.provider);
  const config: ProviderConfig = {
    providerName: input.provider,
    baseUrl: input.baseUrl ?? catalog.baseUrl,
    apiKey: input.apiKey,
    model: input.model ?? catalog.defaultModel,
  };
  return new OpenAICompatibleProvider(config);
}
