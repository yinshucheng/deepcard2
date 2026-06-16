import { describe, it, expect, vi } from 'vitest';
import { cardService } from '../card.service';

describe('cardService', () => {
  describe('create', () => {
    it('should return NOT_FOUND when deck does not exist', async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([]),
          }),
        }),
      } as any;

      const result = await cardService.create(db, 'user1', {
        deckId: 'nonexistent',
        front: 'Q',
        back: 'A',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('牌组不存在');
      }
    });

    it('should create a card when deck exists', async () => {
      const mockCard = {
        id: 'card1',
        deckId: 'deck1',
        userId: 'user1',
        front: '什么是 SRS？',
        back: 'Spaced Repetition System，间隔重复系统',
        state: 'new',
        tags: null,
        createdAt: new Date(),
      };

      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockReturnValue([{ id: 'deck1', userId: 'user1' }]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockCard]),
          }),
        }),
      } as any;

      const result = await cardService.create(db, 'user1', {
        deckId: 'deck1',
        front: '什么是 SRS？',
        back: 'Spaced Repetition System，间隔重复系统',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.front).toBe('什么是 SRS？');
        expect(result.data.back).toBe(
          'Spaced Repetition System，间隔重复系统'
        );
      }
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND for nonexistent card', async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([]),
          }),
        }),
      } as any;

      const result = await cardService.delete(db, 'user1', {
        cardId: 'nonexistent',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should delete an existing card', async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi
              .fn()
              .mockReturnValue([{ id: 'card1', userId: 'user1' }]),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any;

      const result = await cardService.delete(db, 'user1', {
        cardId: 'card1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deleted).toBe(true);
      }
    });
  });

  describe('createBatch', () => {
    it('should return NOT_FOUND when deck does not exist', async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([]),
          }),
        }),
      } as any;

      const result = await cardService.createBatch(db, 'user1', {
        deckId: 'nonexistent',
        cards: [
          { front: 'Q1', back: 'A1' },
          { front: 'Q2', back: 'A2' },
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('suspend', () => {
    it('should return NOT_FOUND for nonexistent card', async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([]),
          }),
        }),
      } as any;

      const result = await cardService.suspend(db, 'user1', {
        cardId: 'nonexistent',
        isSuspended: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });
});
