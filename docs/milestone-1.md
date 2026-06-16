# 里程碑1: 基础架构 + LLM集成核心

## 📋 里程碑概述

**目标**: 建立可运行的基础项目架构并快速实现LLM集成

**时间**: Week 1

**核心价值**: 为整个应用奠定技术基础，验证LLM集成可行性

## 🎯 交付内容

### 1. 后端基础架构
- FastAPI项目正常启动
- 基础项目结构（符合DDD架构）
- 数据库连接和基础配置
- 健康检查API

### 2. LLM抽象层
- 支持多种LLM厂商的统一接口
- OpenAI provider实现
- DeepSeek provider实现（示例）
- 配置管理系统
- 错误处理和重试机制

### 3. 基础API
- LLM连通性测试API
- 文本生成测试API
- 厂商列表API
- 健康检查API

### 4. 自动化测试
- Happy Path测试用例
- API集成测试
- LLM提供商测试

## 🧪 Happy Path 测试标准

### 测试用例1: 健康检查
```bash
GET /health
期望返回: {"status": "healthy", "version": "0.1.0", "app": "DeepCard API"}
状态码: 200
```

### 测试用例2: LLM厂商列表
```bash
GET /api/v1/llm/providers
期望返回: {"providers": ["openai", "deepseek", ...]}
状态码: 200
```

### 测试用例3: LLM连通性测试
```bash
POST /api/v1/llm/test
请求体: {"provider": "openai", "api_key": "test-key"}
期望返回: {"status": "success", "provider": "openai", "model": "gpt-3.5-turbo"}
状态码: 200
```

### 测试用例4: 基础文本生成
```bash
POST /api/v1/llm/generate
请求体: {
  "provider": "openai",
  "model": "gpt-3.5-turbo",
  "prompt": "What is machine learning?"
}
期望返回: {"text": "Machine learning is...", "provider": "openai", "model": "gpt-3.5-turbo"}
状态码: 200
```

## 🏗️ 技术设计

### LLM抽象层架构

```python
# 基础接口
class LLMProvider:
    def __init__(self, api_key: str, model: str):
        pass

    async def generate_text(self, prompt: str) -> str:
        pass

    async def test_connection(self) -> bool:
        pass

# OpenAI实现
class OpenAIProvider(LLMProvider):
    # OpenAI API调用实现

# DeepSeek实现
class DeepSeekProvider(LLMProvider):
    # DeepSeek API调用实现

# 工厂模式
class LLMFactory:
    @staticmethod
    def create_provider(provider_name: str, config: dict) -> LLMProvider:
        # 返回对应的provider实例
```

### 配置管理

```python
# 支持的LLM配置
LLM_CONFIGS = {
    "openai": {
        "models": ["gpt-3.5-turbo", "gpt-4"],
        "base_url": "https://api.openai.com/v1"
    },
    "deepseek": {
        "models": ["deepseek-chat", "deepseek-coder"],
        "base_url": "https://api.deepseek.com/v1"
    }
}
```

### API设计

```
GET /health                              # 健康检查
GET /api/v1/llm/providers               # 获取支持的厂商列表
POST /api/v1/llm/test                   # 测试LLM连通性
POST /api/v1/llm/generate               # 基础文本生成
```

## ✅ 验收标准

- [ ] 后端API在7001端口正常启动
- [ ] 健康检查API返回正确响应
- [ ] 支持至少2个LLM厂商（OpenAI + DeepSeek）
- [ ] LLM连通性测试正常工作
- [ ] 基础文本生成功能正常
- [ ] 所有Happy Path测试通过
- [ ] 错误处理机制正常工作
- [ ] 配置管理系统正常

## 🧪 自动化测试策略

### 测试框架
- **pytest** - 单元测试和集成测试
- **httpx** - HTTP客户端测试
- **pytest-asyncio** - 异步测试支持

### 测试文件结构
```
backend/tests/
├── test_main.py              # 健康检查测试
├── test_llm_providers.py     # LLM提供商测试
├── test_llm_integration.py   # LLM集成测试
└── conftest.py              # 测试配置
```

### 测试数据
- 使用测试API密钥
- Mock成功的API响应
- 测试不同厂商的兼容性

## 📁 文件结构

```
backend/app/
├── main.py                   # FastAPI应用入口
├── shared/
│   ├── config.py            # 配置管理
│   └── database.py          # 数据库配置
├── infrastructure/
│   └── llm/
│       ├── base.py          # LLM基础接口
│       ├── openai.py        # OpenAI实现
│       ├── deepseek.py      # DeepSeek实现
│       └── factory.py       # 工厂模式
├── interfaces/
│   └── api/
│       └── v1/
│           └── endpoints/
│               └── llm.py   # LLM相关API
└── tests/                   # 测试文件
```

## 🚀 开始开发

1. 实现后端基础架构
2. 创建LLM抽象层
3. 实现OpenAI和DeepSeek providers
4. 创建LLM相关API
5. 编写自动化测试
6. 运行测试验证功能
7. 完成里程碑验收

## ⚠️ 注意事项

1. **API密钥安全**: 使用环境变量管理API密钥
2. **错误处理**: 实现优雅的错误处理和重试机制
3. **测试隔离**: 使用测试API密钥，避免产生费用
4. **配置验证**: 验证配置参数的正确性
5. **文档更新**: 及时更新API文档

## 📊 成功指标

- 所有Happy Path测试通过
- LLM响应时间 < 10秒
- API响应时间 < 2秒
- 代码覆盖率 > 80%
- 无已知bug或问题