import { eq, and, asc, desc, ilike, or, sql } from 'drizzle-orm';
import { cards, decks } from '../db/schema';
import type { Database } from '../db/client';
import type {
  CreateCardInput,
  CreateBatchCardsInput,
  UpdateCardInput,
  DeleteCardInput,
  GetCardInput,
  ListCardsByDeckInput,
  SuspendCardInput,
  SearchCardsInput,
} from '../schemas/card.schema';
import { ok, err, type ServiceResult } from './types';

type Card = typeof cards.$inferSelect;

function createCardService() {
  return {
    async create(
      db: Database,
      userId: string,
      input: CreateCardInput
    ): Promise<ServiceResult<Card>> {
      // Verify deck ownership
      const [deck] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)));

      if (!deck) {
        return err('NOT_FOUND', '牌组不存在');
      }

      const [card] = await db
        .insert(cards)
        .values({
          deckId: input.deckId,
          userId,
          front: input.front,
          back: input.back,
          tags: input.tags,
          sourceUrl: input.sourceUrl,
          note: input.note,
        })
        .returning();

      return ok(card);
    },

    async createBatch(
      db: Database,
      userId: string,
      input: CreateBatchCardsInput
    ): Promise<ServiceResult<Card[]>> {
      // Verify deck ownership
      const [deck] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)));

      if (!deck) {
        return err('NOT_FOUND', '牌组不存在');
      }

      const values = input.cards.map((c) => ({
        deckId: input.deckId,
        userId,
        front: c.front,
        back: c.back,
        tags: c.tags,
        sourceUrl: c.sourceUrl,
        note: c.note,
      }));

      const created = await db.insert(cards).values(values).returning();
      return ok(created);
    },

    async update(
      db: Database,
      userId: string,
      input: UpdateCardInput
    ): Promise<ServiceResult<Card>> {
      const [existing] = await db
        .select()
        .from(cards)
        .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId)));

      if (!existing) {
        return err('NOT_FOUND', '卡片不存在');
      }

      const [updated] = await db
        .update(cards)
        .set({
          ...(input.front !== undefined && { front: input.front }),
          ...(input.back !== undefined && { back: input.back }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl }),
          ...(input.note !== undefined && { note: input.note }),
          updatedAt: new Date(),
        })
        .where(eq(cards.id, input.cardId))
        .returning();

      return ok(updated);
    },

    async delete(
      db: Database,
      userId: string,
      input: DeleteCardInput
    ): Promise<ServiceResult<{ deleted: true }>> {
      const [existing] = await db
        .select()
        .from(cards)
        .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId)));

      if (!existing) {
        return err('NOT_FOUND', '卡片不存在');
      }

      await db.delete(cards).where(eq(cards.id, input.cardId));
      return ok({ deleted: true });
    },

    async getById(
      db: Database,
      userId: string,
      input: GetCardInput
    ): Promise<ServiceResult<Card>> {
      const [card] = await db
        .select()
        .from(cards)
        .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId)));

      if (!card) {
        return err('NOT_FOUND', '卡片不存在');
      }

      return ok(card);
    },

    async listByDeck(
      db: Database,
      userId: string,
      input: ListCardsByDeckInput
    ): Promise<ServiceResult<{ cards: Card[]; total: number }>> {
      // Verify deck ownership
      const [deck] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)));

      if (!deck) {
        return err('NOT_FOUND', '牌组不存在');
      }

      const [countResult] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(cards)
        .where(eq(cards.deckId, input.deckId));

      const cardList = await db
        .select()
        .from(cards)
        .where(eq(cards.deckId, input.deckId))
        .orderBy(asc(cards.sortOrder), desc(cards.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return ok({ cards: cardList, total: countResult.total });
    },

    async suspend(
      db: Database,
      userId: string,
      input: SuspendCardInput
    ): Promise<ServiceResult<Card>> {
      const [existing] = await db
        .select()
        .from(cards)
        .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId)));

      if (!existing) {
        return err('NOT_FOUND', '卡片不存在');
      }

      const [updated] = await db
        .update(cards)
        .set({
          isSuspended: input.isSuspended,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, input.cardId))
        .returning();

      return ok(updated);
    },

    async search(
      db: Database,
      userId: string,
      input: SearchCardsInput
    ): Promise<ServiceResult<Card[]>> {
      const conditions = [
        eq(cards.userId, userId),
        or(
          ilike(cards.front, `%${input.query}%`),
          ilike(cards.back, `%${input.query}%`)
        ),
      ];

      if (input.deckId) {
        conditions.push(eq(cards.deckId, input.deckId));
      }

      const result = await db
        .select()
        .from(cards)
        .where(and(...conditions))
        .limit(input.limit)
        .orderBy(desc(cards.updatedAt));

      return ok(result);
    },
  };
}

export const cardService = createCardService();
