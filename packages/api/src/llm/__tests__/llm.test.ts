import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseGeneratedCards } from '../parser';
import {
  getSupportedProviders,
  getProviderCatalog,
  createProvider,
  PROVIDER_CATALOG,
} from '../factory';
import { OpenAICompatibleProvider } from '../provider';
import { buildGenerationPrompt, CARD_TYPES } from '../prompts';
import { LlmConfigurationError } from '../errors';

// ── parser ────────────────────────────────────────
describe('parseGeneratedCards', () => {
  it('解析标准 JSON', () => {
    const resp = JSON.stringify({
      cards: [
        { title: 'T1', content: { front: 'Q1', back: 'A1' }, tags: ['x'] },
        { title: 'T2', content: { front: 'Q2', back: 'A2' }, tags: [] },
      ],
    });
    const cards = parseGeneratedCards(resp);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ title: 'T1', front: 'Q1', back: 'A1', tags: ['x'] });
  });

  it('容错：JSON 前后有解释文字（贪婪正则抠出）', () => {
    const resp =
      '好的，这是卡片：\n```json\n' +
      JSON.stringify({ cards: [{ title: 'T', content: { front: 'Q', back: 'A' } }] }) +
      '\n```\n希望有帮助';
    const cards = parseGeneratedCards(resp);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe('Q');
  });

  it('容错：缺 front/back 的卡片被跳过', () => {
    const resp = JSON.stringify({
      cards: [
        { title: 'ok', content: { front: 'Q', back: 'A' } },
        { title: 'bad', content: { front: 'only front' } },
      ],
    });
    const cards = parseGeneratedCards(resp);
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('ok');
  });

  it('保留类型相关的额外字段到 extra', () => {
    const resp = JSON.stringify({
      cards: [
        {
          title: 'concept',
          content: { front: 'F', back: 'B', concept: 'C', examples: ['e1'] },
        },
      ],
    });
    const cards = parseGeneratedCards(resp);
    expect(cards[0].extra).toMatchObject({ concept: 'C', examples: ['e1'] });
  });

  it('完全无法解析时抛错', () => {
    expect(() => parseGeneratedCards('这不是 JSON 也没有大括号')).toThrow(
      '解析生成内容失败'
    );
  });
});

// ── factory ───────────────────────────────────────
describe('LLM factory', () => {
  it('支持的厂商包含 openai/deepseek/siliconflow/moonshot', () => {
    const providers = getSupportedProviders();
    expect(providers).toEqual(
      expect.arrayContaining(['openai', 'deepseek', 'siliconflow', 'moonshot'])
    );
  });

  it('每个厂商目录有 baseUrl 和 defaultModel', () => {
    for (const name of getSupportedProviders()) {
      const c = getProviderCatalog(name);
      expect(c.baseUrl).toMatch(/^https?:\/\//);
      expect(c.models).toContain(c.defaultModel);
    }
  });

  it('未知厂商抛配置错误', () => {
    expect(() => getProviderCatalog('nope')).toThrow(LlmConfigurationError);
  });

  it('createProvider 缺省 model 时用目录默认', () => {
    const p = createProvider({ provider: 'siliconflow', apiKey: 'k' });
    expect(p.providerName).toBe('siliconflow');
  });
});

// ── prompts ───────────────────────────────────────
describe('buildGenerationPrompt', () => {
  it('4 种类型都能生成 prompt 且含 maxCards 与 text', () => {
    for (const t of CARD_TYPES) {
      const prompt = buildGenerationPrompt('我的文本', t, 3);
      expect(prompt).toContain('我的文本');
      expect(prompt).toContain('3');
      expect(prompt).toContain('JSON');
    }
  });
});

// ── provider retry ────────────────────────────────
describe('OpenAICompatibleProvider.generateWithRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('首次成功直接返回', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }] }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const p = new OpenAICompatibleProvider({
      providerName: 'test',
      baseUrl: 'https://x/v1',
      apiKey: 'k',
      model: 'm',
    });
    await expect(p.generateWithRetry('prompt')).resolves.toBe('hi');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('失败重试 maxRetries+1 次后抛出（用 maxRetries=2 避免长退避）', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const p = new OpenAICompatibleProvider({
      providerName: 'test',
      baseUrl: 'https://x/v1',
      apiKey: 'k',
      model: 'm',
      maxRetries: 2, // 总 3 次调用，退避 1s + 2s
    });
    await expect(p.generateWithRetry('prompt')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
