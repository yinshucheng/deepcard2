/**
 * 单一 OpenAI 兼容 LLM provider。
 * 移植自 deepcard2 Python（openai.py / deepseek.py / siliconflow.py 三者代码相同），
 * TS 版合并为一个 provider，用 baseUrl/model/apiKey 配置区分厂商。
 */
import {
  LlmConnectionError,
  LlmGenerationError,
  LlmConfigurationError,
} from './errors';

export interface ProviderConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OpenAICompatibleProvider {
  readonly providerName: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: ProviderConfig) {
    if (!config.apiKey) {
      throw new LlmConfigurationError(
        `Missing API key for ${config.providerName}`
      );
    }
    this.providerName = config.providerName;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 2000;
    // 默认 1.0：兼容 Moonshot kimi 等只接受 temperature=1 的模型；多数 OpenAI 兼容模型也安全
    this.temperature = config.temperature ?? 1;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  /** 调用 chat/completions，返回文本内容。失败按状态码映射到异常体系。 */
  async generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model ?? this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: opts.maxTokens ?? this.maxTokens,
          temperature: opts.temperature ?? this.temperature,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      throw new LlmConnectionError(
        `Connection error with ${this.providerName}: ${(e as Error).message}`
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new LlmConnectionError(`Invalid API key for ${this.providerName}`);
      }
      if (res.status === 429) {
        throw new LlmConnectionError(`Rate limit exceeded for ${this.providerName}`);
      }
      const body = await res.text().catch(() => '');
      throw new LlmGenerationError(
        `${this.providerName} API error (${res.status}): ${body.slice(0, 200)}`
      );
    }

    try {
      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      return data.choices[0].message.content;
    } catch {
      throw new LlmGenerationError(
        `Invalid response format from ${this.providerName}`
      );
    }
  }

  /**
   * 带重试的生成。退避 min(2^attempt, 10) 秒，总共最多 maxRetries+1 次调用。
   * 移植自 deepcard2 generate_with_retry，无差别捕获所有异常重试。
   */
  async generateWithRetry(
    prompt: string,
    opts: GenerateOptions = {}
  ): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.generateText(prompt, opts);
      } catch (e) {
        lastErr = e;
        if (attempt < this.maxRetries) {
          const waitMs = Math.min(2 ** attempt, 10) * 1000;
          await sleep(waitMs);
        }
      }
    }
    throw lastErr;
  }

  /** 连通性测试：不抛异常，返回 success/error 结构。 */
  async testConnection(): Promise<{
    status: 'success' | 'error';
    provider: string;
    model: string;
    testResponse?: string;
    error?: string;
    message: string;
  }> {
    try {
      const response = await this.generateText(
        `Say 'Hello, ${this.providerName}!'`
      );
      return {
        status: 'success',
        provider: this.providerName,
        model: this.model,
        testResponse: response.slice(0, 100),
        message: 'Connection successful',
      };
    } catch (e) {
      return {
        status: 'error',
        provider: this.providerName,
        model: this.model,
        error: (e as Error).message,
        message: 'Connection failed',
      };
    }
  }
}
