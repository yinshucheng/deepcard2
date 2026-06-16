/**
 * 卡片生成 prompt 模板。1:1 移植自 deepcard2 Python generator.py。
 * 4 种卡片类型：basic / cloze / qna / concept，全中文 prompt。
 */

export type CardType = 'basic' | 'cloze' | 'qna' | 'concept';

export const CARD_TYPES: CardType[] = ['basic', 'cloze', 'qna', 'concept'];

export function buildGenerationPrompt(
  text: string,
  cardType: CardType,
  maxCards: number
): string {
  switch (cardType) {
    case 'basic':
      return `请根据以下文本，生成最多${maxCards}张学习卡片。每张卡片包含一个问题和一个答案。

文本内容：
${text}

请按以下JSON格式返回：
{
    "cards": [
        {
            "title": "卡片标题",
            "content": {
                "front": "问题",
                "back": "答案"
            },
            "tags": ["标签1", "标签2"]
        }
    ]
}

注意：
1. 问题应该基于文本中的重要概念
2. 答案要准确、简洁
3. 标签要反映卡片的主要内容
4. 严格按JSON格式返回`;

    case 'cloze':
      return `请根据以下文本，生成最多${maxCards}张填空题卡片。

文本内容：
${text}

请按以下JSON格式返回：
{
    "cards": [
        {
            "title": "卡片标题",
            "content": {
                "front": "填空题",
                "back": "答案",
                "cloze_text": "带{空格}的文本",
                "cloze_answer": "空格的答案"
            },
            "tags": ["标签1", "标签2"]
        }
    ]
}

注意：
1. 选择文本中的关键信息作为空格
2. 空格应该测试对重要概念的理解
3. 严格按JSON格式返回`;

    case 'qna':
      return `请根据以下文本，生成最多${maxCards}张问答对卡片。

文本内容：
${text}

请按以下JSON格式返回：
{
    "cards": [
        {
            "title": "卡片标题",
            "content": {
                "front": "问答对",
                "back": "问答对",
                "question": "问题",
                "answer": "答案"
            },
            "tags": ["标签1", "标签2"]
        }
    ]
}

注意：
1. 问题应该覆盖文本的核心内容
2. 答案要全面且准确
3. 严格按JSON格式返回`;

    case 'concept':
      return `请根据以下文本，生成最多${maxCards}张概念卡片。

文本内容：
${text}

请按以下JSON格式返回：
{
    "cards": [
        {
            "title": "卡片标题",
            "content": {
                "front": "概念",
                "back": "概念",
                "concept": "概念名称",
                "definition": "概念定义",
                "examples": ["示例1", "示例2"]
            },
            "tags": ["标签1", "标签2"]
        }
    ]
}

注意：
1. 识别文本中的重要概念
2. 提供清晰的定义和具体的例子
3. 严格按JSON格式返回`;
  }
}
