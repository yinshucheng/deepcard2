import { z } from 'zod';

const CARD_TYPES = ['basic', 'cloze', 'qna', 'concept'] as const;

/** 可选覆盖系统默认 provider 的配置（不传则用 env 默认 LLM） */
const ProviderOverride = {
  provider: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
};

export const TestLlmConnectionSchema = z.object(ProviderOverride);

export const GenerateTextSchema = z.object({
  prompt: z.string().min(1).max(20000),
  ...ProviderOverride,
});

export const GenerateCardsSchema = z.object({
  text: z.string().min(1).max(20000),
  cardType: z.enum(CARD_TYPES).default('basic'),
  maxCards: z.number().int().min(1).max(20).default(5),
  // 落库相关：auto_save 为 true 时存入指定 deck
  autoSave: z.boolean().default(false),
  deckId: z.string().uuid().optional(),
  sourceUrl: z.string().url().optional(),
  ...ProviderOverride,
});

export type TestLlmConnectionInput = z.infer<typeof TestLlmConnectionSchema>;
export type GenerateTextInput = z.infer<typeof GenerateTextSchema>;
export type GenerateCardsInput = z.infer<typeof GenerateCardsSchema>;
