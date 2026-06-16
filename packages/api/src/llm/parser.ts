/**
 * LLM 生成结果解析。移植自 deepcard2 Python _parse_generated_cards。
 * 容错策略：贪婪正则抠出 JSON + 逐卡片 try/skip。
 */

export interface ParsedCard {
  title: string;
  front: string;
  back: string;
  tags: string[];
  /** 类型相关的额外内容（cloze_text / question / concept 等），原样保留 */
  extra: Record<string, unknown>;
}

/** 从可能含解释文字的 LLM 回复中抠出 JSON 对象并解析 */
function extractJson(responseText: string): unknown {
  // 贪婪匹配第一个 { 到最后一个 }（应对 LLM 在 JSON 前后加文字）
  const match = responseText.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : responseText;
  return JSON.parse(jsonStr);
}

/**
 * 解析生成的卡片。整体 JSON 解析失败抛错；单张卡片缺 front/back 则跳过。
 */
export function parseGeneratedCards(responseText: string): ParsedCard[] {
  let data: unknown;
  try {
    data = extractJson(responseText);
  } catch {
    throw new Error('解析生成内容失败');
  }

  const rawCards =
    (data as { cards?: unknown[] })?.cards ?? [];
  if (!Array.isArray(rawCards)) {
    return [];
  }

  const result: ParsedCard[] = [];
  for (const raw of rawCards) {
    try {
      const cardData = raw as {
        title?: string;
        content?: Record<string, unknown>;
        tags?: string[];
      };
      const content = cardData.content ?? {};
      const front = content.front;
      const back = content.back;
      // front/back 是 cards 表必填项，缺失则跳过该卡片
      if (typeof front !== 'string' || typeof back !== 'string') {
        continue;
      }
      const { front: _f, back: _b, ...extra } = content;
      result.push({
        title: cardData.title ?? '',
        front,
        back,
        tags: Array.isArray(cardData.tags) ? cardData.tags : [],
        extra,
      });
    } catch {
      // 跳过无效卡片，不影响其他卡片
      continue;
    }
  }
  return result;
}
