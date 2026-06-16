# DeepCard - 基于LLM的闪卡应用

## 项目概述

DeepCard 是一个基于大语言模型(LLM)的智能闪卡应用，支持从多种内容源自动生成学习卡片，并提供科学的记忆复习系统。

## 核心功能

### 1. 内容生成
- 基于博客文章、微博、书籍等内容生成闪卡
- 支持完全基于LLM的自定义闪卡生成
- 智能提取关键知识点和概念

### 2. 资源关联
- 卡片能够快速回归到原始资源
- 支持多种内容源格式和链接

### 3. 记忆系统
- 基于遗忘曲线的复习提醒
- 科学的学习进度追踪

## 技术栈

### 后端
- **语言**: Python 3.11+
- **框架**: FastAPI
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **缓存**: Redis
- **LLM集成**: OpenAI API / Claude API

### 前端
- **框架**: React 18 + Next.js 14
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **UI组件**: shadcn/ui

### 开发工具
- **包管理**: Poetry (后端) + pnpm (前端)
- **代码格式化**: Black, isort (Python) + Prettier (TypeScript)
- **类型检查**: mypy (Python) + TypeScript
- **测试**: pytest (Python) + Jest (TypeScript)

## 架构原则

1. **简单**: 避免过度设计，采用当前最合适的方案
2. **适用**: 解决实际问题，不追求完美的架构
3. **演进**: 支持渐进式迭代，便于后续扩展

## 领域驱动设计 (DDD)

### 核心领域

#### 1. 卡片领域 (Card Domain)
- 卡片创建、编辑、删除
- 卡片内容管理
- 卡片类型和格式

#### 2. 资源领域 (Resource Domain)
- 原始资源管理
- 内���解析和提取
- 资源关联

#### 3. 学习领域 (Learning Domain)
- 记忆算法
- 学习进度追踪
- 复习计划

#### 4. 生成领域 (Generation Domain)
- LLM集成
- 内容生成策略
- 智能提取

## 项目结构

```
deepcard2/
├── backend/                 # 后端代码
│   ├── app/
│   │   ├── domains/        # 领域层
│   │   │   ├── card/       # 卡片领域
│   │   │   ├── resource/   # 资源领域
│   │   │   ├── learning/   # 学习领域
│   │   │   └── generation/ # 生成领域
│   │   ├── infrastructure/ # 基础设施层
│   │   │   ├── database/   # 数据库
│   │   │   ├── llm/        # LLM集成
│   │   │   └── cache/      # 缓存
│   │   ├── application/    # 应用层
│   │   │   ├── services/   # 应用服务
│   │   │   └── dto/        # 数据传输对象
│   │   ├── interfaces/     # 接口层
│   │   │   ├── api/        # API路由
│   │   │   └── middleware/ # 中间件
│   │   └── shared/         # 共享模块
│   │       ├── models/     # 共享模型
│   │       └── utils/      # 工具函数
│   ├── tests/              # 测试代码
│   ├── poetry.lock         # 依赖锁定
│   └── pyproject.toml      # 项目配置
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── features/       # 功能模块
│   │   │   ├── cards/      # 卡片功能
│   │   │   ├── resources/  # 资源功能
│   │   │   ├── learning/   # 学习功能
│   │   │   └── generation/ # 生成功能
│   │   ├── hooks/          # 自定义钩子
│   │   ├── services/       # API服务
│   │   ├── store/          # 状态管理
│   │   ├── types/          # 类型定义
│   │   └── utils/          # 工具函数
│   ├── public/             # 静态资源
│   ├── package.json        # 项目配置
│   └── next.config.js      # Next.js配置
├── docs/                   # 项目文档
├── docker-compose.yml      # 开发环境
└── README.md              # 项目说明
```

## 数据库设计

### 核心表结构

#### cards (卡片表)
- id: 主键
- front: 正面内容
- back: 背面内容
- type: 卡片类型 (basic, cloze, qna)
- source_id: 来源资源ID
- created_at: 创建时间
- updated_at: 更新时间

#### resources (资源表)
- id: 主键
- title: 标题
- url: 原始链接
- content: 原始内容
- type: 资源类型 (article, book, social)
- created_at: 创建时间

#### learning_records (学习记录表)
- id: 主键
- card_id: 卡片ID
- user_id: 用户ID
- ease_factor: 难度因子
- interval: 复习间隔
- repetitions: 重复次数
- next_review: 下次复习时间
- last_review: 最后复习时间

## 开发计划

### Phase 1: 基础功能 (MVP)
1. 项目基础结构搭建
2. 数据库设计和基础API
3. 简单的卡片创建和管理
4. 基础的前端界面

### Phase 2: 核心功能
1. LLM集成和卡片生成
2. 资源内容解析
3. 基础记忆算法实现

### Phase 3: 高级功能
1. 完整的记忆系统
2. 高级生成策略
3. 性能优化和用户体验提升

## 快速开始

### 使用Docker (推荐)

```bash
# 1. 克隆项目
git clone <repository-url>
cd deepcard2

# 2. 一键启动开发环境
./start-dev.sh

# 3. 访问应用
# 前端: http://localhost:3000
# API文档: http://localhost:7001/docs
```

### 本地开发

详细开发指南请参考 [DEVELOPMENT.md](./DEVELOPMENT.md)

## 项目状态

### ✅ 已完成
- [x] 项目架构设计
- [x] 数据库schema设计
- [x] 基础项目结构
- [x] 开发环境配置

### 🚧 进行中
- [ ] 用户认证系统
- [ ] 数据库模型实现
- [ ] 基础API端点

### 📋 待开发
- [ ] LLM集成
- [ ] 前端界面
- [ ] 记忆算法
- [ ] 部署配置

## 部署策略

### 开发环境
- Docker Compose 一键启动
- 热重载开发服务器
- 数据库迁移和种子数据

### 生产环境
- 后端: Uvicorn + Nginx
- 前端: Next.js 静态生成
- 数据库: PostgreSQL + Redis
- 容器化部署 (Docker)