import { z } from 'zod';
import type { Database } from '../db/client';
import type { ServiceResult } from '../services/types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** 系统默认 LLM 配置（OpenAI 兼容），从 worker env 注入到 operation 上下文 */
export interface LlmConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

/** operation execute 的上下文：协议无关，由 adapter 层填充 */
export interface OperationContext {
  userId: string;
  db: Database;
  llm?: LlmConfig;
}

export interface Operation<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown,
> {
  name: string;
  description: string;
  category: string;
  inputSchema: TInput;
  execute: (
    input: z.infer<TInput>,
    ctx: OperationContext
  ) => Promise<ServiceResult<TOutput>>;
  rest: {
    method: HttpMethod;
    path: string;
  };
  scope: 'read' | 'write';
}

class OperationRegistry {
  private operations = new Map<string, Operation>();

  register<TInput extends z.ZodTypeAny, TOutput>(
    op: Operation<TInput, TOutput>
  ): void {
    if (this.operations.has(op.name)) {
      throw new Error(`Operation "${op.name}" already registered`);
    }
    this.operations.set(op.name, op as unknown as Operation);
  }

  get(name: string): Operation | undefined {
    return this.operations.get(name);
  }

  getAll(): Operation[] {
    return Array.from(this.operations.values());
  }

  getByCategory(category: string): Operation[] {
    return this.getAll().filter((op) => op.category === category);
  }

  getCategories(): string[] {
    return [...new Set(this.getAll().map((op) => op.category))];
  }
}

export const registry = new OperationRegistry();
