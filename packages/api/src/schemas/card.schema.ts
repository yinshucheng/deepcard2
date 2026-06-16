import { z } from 'zod';

export const CreateCardSchema = z.object({
  deckId: z.string().uuid(),
  front: z.string().min(1).max(10000),
  back: z.string().min(1).max(10000),
  tags: z.array(z.string().max(100)).max(20).optional(),
  sourceUrl: z.string().url().optional(),
  note: z.string().max(5000).optional(),
});

export const CreateBatchCardsSchema = z.object({
  deckId: z.string().uuid(),
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(10000),
        back: z.string().min(1).max(10000),
        tags: z.array(z.string().max(100)).max(20).optional(),
        sourceUrl: z.string().url().optional(),
        note: z.string().max(5000).optional(),
      })
    )
    .min(1)
    .max(100),
});

export const UpdateCardSchema = z.object({
  cardId: z.string().uuid(),
  front: z.string().min(1).max(10000).optional(),
  back: z.string().min(1).max(10000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  sourceUrl: z.string().url().nullable().optional(),
  note: z.string().max(5000).nullable().optional(),
});

export const DeleteCardSchema = z.object({
  cardId: z.string().uuid(),
});

export const GetCardSchema = z.object({
  cardId: z.string().uuid(),
});

export const ListCardsByDeckSchema = z.object({
  deckId: z.string().uuid(),
  // GET query 参数是字符串，用 coerce 自动转数字
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const SuspendCardSchema = z.object({
  cardId: z.string().uuid(),
  isSuspended: z.boolean(),
});

export const SearchCardsSchema = z.object({
  query: z.string().min(1).max(500),
  deckId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type CreateBatchCardsInput = z.infer<typeof CreateBatchCardsSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type DeleteCardInput = z.infer<typeof DeleteCardSchema>;
export type GetCardInput = z.infer<typeof GetCardSchema>;
export type ListCardsByDeckInput = z.infer<typeof ListCardsByDeckSchema>;
export type SuspendCardInput = z.infer<typeof SuspendCardSchema>;
export type SearchCardsInput = z.infer<typeof SearchCardsSchema>;
