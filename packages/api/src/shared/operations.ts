import { registry } from './registry';
import { deckService } from '../services/deck.service';
import { cardService } from '../services/card.service';
import { llmService } from '../services/llm.service';
import {
  TestLlmConnectionSchema,
  GenerateTextSchema,
  GenerateCardsSchema,
} from '../schemas/llm.schema';
import {
  CreateDeckSchema,
  UpdateDeckSchema,
  DeleteDeckSchema,
  GetDeckSchema,
  ReorderDecksSchema,
} from '../schemas/deck.schema';
import {
  CreateCardSchema,
  CreateBatchCardsSchema,
  UpdateCardSchema,
  DeleteCardSchema,
  GetCardSchema,
  ListCardsByDeckSchema,
  SuspendCardSchema,
  SearchCardsSchema,
} from '../schemas/card.schema';
import { z } from 'zod';

// ── Deck operations ───────────────────────────────

registry.register({
  name: 'create_deck',
  description: '创建一个新牌组',
  category: 'decks',
  inputSchema: CreateDeckSchema,
  execute: (input, ctx) => deckService.create(ctx.db, ctx.userId, input),
  rest: { method: 'POST', path: '/decks' },
  scope: 'write',
});

registry.register({
  name: 'update_deck',
  description: '更新牌组信息',
  category: 'decks',
  inputSchema: UpdateDeckSchema,
  execute: (input, ctx) => deckService.update(ctx.db, ctx.userId, input),
  rest: { method: 'PATCH', path: '/decks/:deckId' },
  scope: 'write',
});

registry.register({
  name: 'delete_deck',
  description: '删除一个牌组及其所有卡片',
  category: 'decks',
  inputSchema: DeleteDeckSchema,
  execute: (input, ctx) => deckService.delete(ctx.db, ctx.userId, input),
  rest: { method: 'DELETE', path: '/decks/:deckId' },
  scope: 'write',
});

registry.register({
  name: 'get_deck',
  description: '获取牌组详情（含统计信息）',
  category: 'decks',
  inputSchema: GetDeckSchema,
  execute: (input, ctx) => deckService.getById(ctx.db, ctx.userId, input),
  rest: { method: 'GET', path: '/decks/:deckId' },
  scope: 'read',
});

registry.register({
  name: 'list_decks',
  description: '列出用户的所有牌组',
  category: 'decks',
  inputSchema: z.object({}),
  execute: (_input, ctx) => deckService.list(ctx.db, ctx.userId),
  rest: { method: 'GET', path: '/decks' },
  scope: 'read',
});

registry.register({
  name: 'reorder_decks',
  description: '重新排序牌组',
  category: 'decks',
  inputSchema: ReorderDecksSchema,
  execute: (input, ctx) => deckService.reorder(ctx.db, ctx.userId, input),
  rest: { method: 'PUT', path: '/decks/reorder' },
  scope: 'write',
});

// ── Card operations ───────────────────────────────

registry.register({
  name: 'create_card',
  description: '在牌组中创建一张新闪卡',
  category: 'cards',
  inputSchema: CreateCardSchema,
  execute: (input, ctx) => cardService.create(ctx.db, ctx.userId, input),
  rest: { method: 'POST', path: '/cards' },
  scope: 'write',
});

registry.register({
  name: 'create_batch_cards',
  description: '批量创建闪卡',
  category: 'cards',
  inputSchema: CreateBatchCardsSchema,
  execute: (input, ctx) => cardService.createBatch(ctx.db, ctx.userId, input),
  rest: { method: 'POST', path: '/cards/batch' },
  scope: 'write',
});

registry.register({
  name: 'update_card',
  description: '更新闪卡内容',
  category: 'cards',
  inputSchema: UpdateCardSchema,
  execute: (input, ctx) => cardService.update(ctx.db, ctx.userId, input),
  rest: { method: 'PATCH', path: '/cards/:cardId' },
  scope: 'write',
});

registry.register({
  name: 'delete_card',
  description: '删除一张闪卡',
  category: 'cards',
  inputSchema: DeleteCardSchema,
  execute: (input, ctx) => cardService.delete(ctx.db, ctx.userId, input),
  rest: { method: 'DELETE', path: '/cards/:cardId' },
  scope: 'write',
});

registry.register({
  name: 'get_card',
  description: '获取闪卡详情',
  category: 'cards',
  inputSchema: GetCardSchema,
  execute: (input, ctx) => cardService.getById(ctx.db, ctx.userId, input),
  rest: { method: 'GET', path: '/cards/:cardId' },
  scope: 'read',
});

registry.register({
  name: 'list_cards_by_deck',
  description: '列出牌组中的所有闪卡',
  category: 'cards',
  inputSchema: ListCardsByDeckSchema,
  execute: (input, ctx) => cardService.listByDeck(ctx.db, ctx.userId, input),
  rest: { method: 'GET', path: '/decks/:deckId/cards' },
  scope: 'read',
});

registry.register({
  name: 'suspend_card',
  description: '暂停/恢复闪卡',
  category: 'cards',
  inputSchema: SuspendCardSchema,
  execute: (input, ctx) => cardService.suspend(ctx.db, ctx.userId, input),
  rest: { method: 'PATCH', path: '/cards/:cardId/suspend' },
  scope: 'write',
});

registry.register({
  name: 'search_cards',
  description: '搜索闪卡',
  category: 'cards',
  inputSchema: SearchCardsSchema,
  execute: (input, ctx) => cardService.search(ctx.db, ctx.userId, input),
  rest: { method: 'GET', path: '/cards/search' },
  scope: 'read',
});

// ── LLM operations ────────────────────────────────

registry.register({
  name: 'list_llm_providers',
  description: '列出支持的 LLM 厂商及其可用模型',
  category: 'llm',
  inputSchema: z.object({}),
  execute: () => llmService.listProviders(),
  rest: { method: 'GET', path: '/llm/providers' },
  scope: 'read',
});

registry.register({
  name: 'test_llm_connection',
  description: '测试 LLM 连通性（默认用系统 LLM，可指定 provider+apiKey）',
  category: 'llm',
  inputSchema: TestLlmConnectionSchema,
  execute: (input, ctx) => llmService.testConnection(input, ctx.llm),
  rest: { method: 'POST', path: '/llm/test' },
  scope: 'read',
});

registry.register({
  name: 'generate_text',
  description: '用 LLM 生成文本',
  category: 'llm',
  inputSchema: GenerateTextSchema,
  execute: (input, ctx) => llmService.generateText(input, ctx.llm),
  rest: { method: 'POST', path: '/llm/generate' },
  scope: 'write',
});

registry.register({
  name: 'generate_cards',
  description:
    '从文本生成学习卡片（支持 basic/cloze/qna/concept 四种类型；autoSave=true 时存入指定 deck）',
  category: 'cards',
  inputSchema: GenerateCardsSchema,
  execute: (input, ctx) =>
    llmService.generateCards(ctx.db, ctx.userId, input, ctx.llm),
  rest: { method: 'POST', path: '/cards/generate' },
  scope: 'write',
});
