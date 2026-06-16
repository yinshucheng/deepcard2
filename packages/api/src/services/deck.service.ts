import { eq, and, asc, lte, ne, sql, count } from 'drizzle-orm';
import { decks, cards } from '../db/schema';
import type { Database } from '../db/client';
import type {
  CreateDeckInput,
  UpdateDeckInput,
  DeleteDeckInput,
  GetDeckInput,
  ReorderDecksInput,
} from '../schemas/deck.schema';
import { ok, err, type ServiceResult } from './types';

export interface DeckWithStats {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  coverColor: string | null;
  isPublic: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  cardCount: number;
  newCount: number;
  dueCount: number;
}

async function getDeckCardStats(db: Database, deckId: string) {
  const stats = await db
    .select({
      total: count(),
      newCount: count(sql`CASE WHEN ${cards.state} = 'new' THEN 1 END`),
      dueCount: sql<number>`count(CASE WHEN ${cards.due} <= now() AND ${cards.state} != 'new' AND ${cards.isSuspended} = false THEN 1 END)`,
    })
    .from(cards)
    .where(and(eq(cards.deckId, deckId), eq(cards.isSuspended, false)));

  return {
    cardCount: stats[0]?.total ?? 0,
    newCount: stats[0]?.newCount ?? 0,
    dueCount: Number(stats[0]?.dueCount ?? 0),
  };
}

function createDeckService() {
  return {
    async create(
      db: Database,
      userId: string,
      input: CreateDeckInput
    ): Promise<ServiceResult<typeof decks.$inferSelect>> {
      const [deck] = await db
        .insert(decks)
        .values({
          userId,
          title: input.title,
          description: input.description,
          coverColor: input.coverColor,
        })
        .returning();
      return ok(deck);
    },

    async update(
      db: Database,
      userId: string,
      input: UpdateDeckInput
    ): Promise<ServiceResult<typeof decks.$inferSelect>> {
      const [existing] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)));

      if (!existing) {
        return err('NOT_FOUND', '牌组不存在');
      }

      const [updated] = await db
        .update(decks)
        .set({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.coverColor !== undefined && {
            coverColor: input.coverColor,
          }),
          ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
          updatedAt: new Date(),
        })
        .where(eq(decks.id, input.deckId))
        .returning();

      return ok(updated);
    },

    async delete(
      db: Database,
      userId: string,
      input: DeleteDeckInput
    ): Promise<ServiceResult<{ deleted: true }>> {
      const [existing] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)));

      if (!existing) {
        return err('NOT_FOUND', '牌组不存在');
      }

      await db.delete(decks).where(eq(decks.id, input.deckId));
      return ok({ deleted: true });
    },

    async getById(
      db: Database,
      userId: string,
      input: GetDeckInput
    ): Promise<ServiceResult<DeckWithStats>> {
      const [deck] = await db
        .select()
        .from(decks)
        .where(and(eq(decks.id, input.deckId), eq(decks.userId, userId)));

      if (!deck) {
        return err('NOT_FOUND', '牌组不存在');
      }

      const deckStats = await getDeckCardStats(db, input.deckId);

      return ok({
        ...deck,
        ...deckStats,
      });
    },

    async list(
      db: Database,
      userId: string
    ): Promise<ServiceResult<DeckWithStats[]>> {
      const userDecks = await db
        .select()
        .from(decks)
        .where(eq(decks.userId, userId))
        .orderBy(asc(decks.sortOrder), asc(decks.createdAt));

      const result: DeckWithStats[] = [];

      for (const deck of userDecks) {
        const deckStats = await getDeckCardStats(db, deck.id);
        result.push({ ...deck, ...deckStats });
      }

      return ok(result);
    },

    async reorder(
      db: Database,
      userId: string,
      input: ReorderDecksInput
    ): Promise<ServiceResult<{ reordered: true }>> {
      for (let i = 0; i < input.deckIds.length; i++) {
        await db
          .update(decks)
          .set({ sortOrder: i })
          .where(
            and(eq(decks.id, input.deckIds[i]), eq(decks.userId, userId))
          );
      }
      return ok({ reordered: true });
    },
  };
}

export const deckService = createDeckService();
