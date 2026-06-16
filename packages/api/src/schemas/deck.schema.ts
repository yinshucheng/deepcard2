import { z } from 'zod';

export const CreateDeckSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  coverColor: z.string().max(20).optional(),
});

export const UpdateDeckSchema = z.object({
  deckId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  coverColor: z.string().max(20).optional(),
  isPublic: z.boolean().optional(),
});

export const DeleteDeckSchema = z.object({
  deckId: z.string().uuid(),
});

export const GetDeckSchema = z.object({
  deckId: z.string().uuid(),
});

export const ListDecksSchema = z.object({}).optional();

export const ReorderDecksSchema = z.object({
  deckIds: z.array(z.string().uuid()),
});

export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type DeleteDeckInput = z.infer<typeof DeleteDeckSchema>;
export type GetDeckInput = z.infer<typeof GetDeckSchema>;
export type ReorderDecksInput = z.infer<typeof ReorderDecksSchema>;
