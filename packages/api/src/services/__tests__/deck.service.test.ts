import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deckService } from '../deck.service';

// Mock database that simulates Drizzle's query builder pattern
function createMockDb(data: {
  decks?: any[];
  cardStats?: { total: number; newCount: number; dueCount: number };
}) {
  const mockDecks = data.decks ?? [];
  const stats = data.cardStats ?? { total: 0, newCount: 0, dueCount: 0 };

  // Chainable query builder mock
  const createChain = (returnValue: any) => {
    const chain: any = {};
    const methods = [
      'select',
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'set',
      'values',
      'returning',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Terminal methods return data
    chain.returning = vi.fn().mockResolvedValue(returnValue);
    // Make chain thenable for await
    chain.then = (resolve: any) => resolve(returnValue);
    return chain;
  };

  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(mockDecks),
        orderBy: vi.fn().mockReturnValue(mockDecks),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(mockDecks),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(mockDecks),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as any;
}

describe('deckService', () => {
  describe('create', () => {
    it('should create a deck and return it', async () => {
      const mockDeck = {
        id: '123',
        userId: 'user1',
        title: '日语 N3',
        description: null,
        coverColor: null,
        isPublic: false,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const db = createMockDb({ decks: [mockDeck] });
      const result = await deckService.create(db, 'user1', {
        title: '日语 N3',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('日语 N3');
        expect(result.data.id).toBe('123');
      }
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND when deck does not exist', async () => {
      const db = createMockDb({ decks: [] });
      const result = await deckService.delete(db, 'user1', {
        deckId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should delete an existing deck', async () => {
      const mockDeck = {
        id: 'deck1',
        userId: 'user1',
        title: 'Test',
      };

      // Need select to find the deck first, then delete
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([mockDeck]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any;

      const result = await deckService.delete(db, 'user1', {
        deckId: 'deck1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deleted).toBe(true);
      }
    });
  });

  describe('update', () => {
    it('should return NOT_FOUND for nonexistent deck', async () => {
      const db = createMockDb({ decks: [] });
      const result = await deckService.update(db, 'user1', {
        deckId: 'nonexistent',
        title: 'New Title',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
