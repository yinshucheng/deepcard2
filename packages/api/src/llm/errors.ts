/** LLM 异常体系（移植自 deepcard2 Python: base.py） */

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

/** 连接失败：401(invalid key) / 429(rate limit) / 网络错误 */
export class LlmConnectionError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConnectionError';
  }
}

/** 生成失败：其他 HTTP 错误、响应格式错误 */
export class LlmGenerationError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'LlmGenerationError';
  }
}

/** 配置无效：未知 provider、缺 provider/api_key */
export class LlmConfigurationError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConfigurationError';
  }
}
