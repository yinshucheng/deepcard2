/**
 * LLM 应用服务。移植自 deepcard2 Python CardGenerator + LLM endpoints。
 * 注意：LLM 操作除 (db, userId, input) 外，还需 ctx.llm（env 注入的系统默认 LLM 配置）。
 */
import { eq, and } from 'drizzle-orm';
import { cards, decks } from '../db/schema';
import type { Database } from '../db/client';
import type { LlmConfig } from '../shared/registry';
import { ok, err, type ServiceResult } from './types';
import {
  createProvider,
  getSupportedProviders,
  PROVIDER_CATALOG,
} from '../llm/factory';
import { OpenAICompatibleProvider } from '../llm/provider';
import { buildGenerationPrompt, type CardType } from '../llm/prompts';
import { parseGeneratedCards } from '../llm/parser';
import { LlmError } from '../llm/errors';
import type {
  TestLlmConnectionInput,
  GenerateTextInput,
  GenerateCardsInput,
} from '../schemas/llm.schema';

type Card = typeof cards.$inferSelect;

interface ProviderOverride {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/**
 * 解析有效的 provider 配置：
 * - 请求体显式指定 provider+apiKey → 用请求的
 * - 否则用 env 注入的系统默认 LLM（baseUrl/apiKey/model）
 */
function resolveProvider(input: ProviderOverride, llm?: LlmConfig) {
  // 显式指定厂商（需要 apiKey）
  if (input.provider) {
    if (!input.apiKey) {
      return err<never>('VALIDATION_ERROR', `使用 provider "${input.provider}" 需要提供 apiKey`);
    }
    return ok(
      createProvider({
        provider: input.provider,
        apiKey: input.apiKey,
        model: input.model,
        baseUrl: input.baseUrl,
      })
    );
  }

  // 回退到系统默认 LLM（env：LLM_BASE_URL / LLM_API_KEY / LLM_MODEL）
  const apiKey = input.apiKey ?? llm?.apiKey;
  const baseUrl = input.baseUrl ?? llm?.baseUrl;
  const model = input.model ?? llm?.model;
  if (!apiKey || !baseUrl) {
    return err<never>(
      'VALIDATION_ERROR',
      '未配置 LLM：请在请求中指定 provider+apiKey，或在 env 设置 LLM_BASE_URL/LLM_API_KEY'
    );
  }
  // 系统默认走 OpenAI 兼容协议，用 'custom' 作为名字
  return ok(
    createProviderFromConfig({ baseUrl, apiKey, model: model ?? 'default' })
  );
}

// 直接用 baseUrl/apiKey/model 建 provider（系统默认 LLM，不查厂商目录）
function createProviderFromConfig(cfg: { baseUrl: string; apiKey: string; model: string }) {
  return new OpenAICompatibleProvider({
    providerName: 'default',
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    model: cfg.model,
  });
}

function createLlmService() {
  return {
    /** 列出支持的厂商及其模型目录 */
    async listProviders(): Promise<
      ServiceResult<{ providers: typeof PROVIDER_CATALOG; supported: string[] }>
    > {
      return ok({
        providers: PROVIDER_CATALOG,
        supported: getSupportedProviders(),
      });
    },

    /** 测试 LLM 连通性 */
    async testConnection(
      input: TestLlmConnectionInput,
      llm?: LlmConfig
    ): Promise<ServiceResult<Record<string, unknown>>> {
      const resolved = resolveProvider(input, llm);
      if (!resolved.success) return resolved;
      const result = await resolved.data.testConnection();
      return ok(result as Record<string, unknown>);
    },

    /** 通用文本生成 */
    async generateText(
      input: GenerateTextInput,
      llm?: LlmConfig
    ): Promise<ServiceResult<{ text: string }>> {
      const resolved = resolveProvider(input, llm);
      if (!resolved.success) return resolved;
      try {
        const text = await resolved.data.generateWithRetry(input.prompt);
        return ok({ text });
      } catch (e) {
        return err('INTERNAL_ERROR', `LLM 生成失败: ${(e as Error).message}`);
      }
    },

    /**
     * 从文本生成卡片。autoSave=true 时落库到指定 deck。
     * 移植自 deepcard2 generate_cards_from_text，修正为走 generateWithRetry。
     */
    async generateCards(
      db: Database,
      userId: string,
      input: GenerateCardsInput,
      llm?: LlmConfig
    ): Promise<
      ServiceResult<{
        cards: { title: string; front: string; back: string; tags: string[] }[];
        saved: Card[] | null;
      }>
    > {
      const resolved = resolveProvider(input, llm);
      if (!resolved.success) return resolved;

      // 落库前先校验 deck 归属
      if (input.autoSave) {
        if (!input.deckId) {
          return err('VALIDATION_ERROR', 'autoSave 为 true 时必须提供 deckId');
        }
        const [deck] = await db
          .select()
          .from(decks)
          .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)));
        if (!deck) {
          return err('NOT_FOUND', '牌组不存在');
        }
      }

      const prompt = buildGenerationPrompt(
        input.text,
        input.cardType as CardType,
        input.maxCards
      );

      let raw: string;
      try {
        raw = await resolved.data.generateWithRetry(prompt);
      } catch (e) {
        const code = e instanceof LlmError ? 'INTERNAL_ERROR' : 'INTERNAL_ERROR';
        return err(code, `LLM 生成失败: ${(e as Error).message}`);
      }

      let parsed;
      try {
        parsed = parseGeneratedCards(raw);
      } catch (e) {
        return err('INTERNAL_ERROR', (e as Error).message);
      }

      const generated = parsed.map((p) => ({
        title: p.title,
        front: p.front,
        back: p.back,
        tags: p.tags,
      }));

      // 落库
      let saved: Card[] | null = null;
      if (input.autoSave && input.deckId && generated.length > 0) {
        const values = generated.map((c) => ({
          deckId: input.deckId!,
          userId,
          front: c.front,
          back: c.back,
          tags: c.tags,
          sourceUrl: input.sourceUrl,
        }));
        saved = await db.insert(cards).values(values).returning();
      }

      return ok({ cards: generated, saved });
    },
  };
}

export const llmService = createLlmService();
