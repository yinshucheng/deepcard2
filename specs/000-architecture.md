# 000 — 架构基线：Operation Registry + 协议无关 Service 层

- **状态**: accepted
- **优先级**: —
- **创建**: 2026-06-16

> 这是**不可违反的架构基线**。所有新特性的技术方案都必须说明「如何不破坏这条基线」。改动本文件需要明确的架构决策，不是随手改。

## 一句话

**业务逻辑只写一遍（Service），通过 Operation Registry 注册一次，自动派生多种入口（REST / MCP / SKILL / 浏览器插件）。** AI Agent 与人类用户是平等的一等公民，共享同一套经过校验、带所有权检查的操作。

## 分层（自内向外）

```
┌─────────────────────────────────────────────────────────┐
│  入口（Adapters）—— 可插拔，从 registry 派生，不含业务逻辑   │
│   REST (adapters/rest/app.ts)  │  MCP (规划)  │  SKILL (规划) │
└───────────────────────┬─────────────────────────────────┘
                        │  遍历 registry.getAll()
┌───────────────────────▼─────────────────────────────────┐
│  Operation Registry (shared/registry.ts + operations.ts)  │
│   每个 operation: name / description / category /          │
│   inputSchema(Zod) / execute / rest 映射 / scope           │
└───────────────────────┬─────────────────────────────────┘
                        │  execute(input, ctx) 调用
┌───────────────────────▼─────────────────────────────────┐
│  Service 层 (services/*.ts)  —— 零协议依赖                  │
│   签名: (db, userId, input) => Promise<ServiceResult<T>>   │
│   不知道自己被 REST 还是 MCP 调用                            │
└───────────────────────┬─────────────────────────────────┘
                        │  Drizzle ORM
┌───────────────────────▼─────────────────────────────────┐
│  数据层: Supabase Postgres (db/schema.ts, Drizzle)         │
└─────────────────────────────────────────────────────────┘
```

## 五条不可违反的规则

### 1. 新增能力 = 新增 operation，不绕过 registry
任何对外暴露的能力都必须注册为 operation（`shared/operations.ts`）。**不允许**在 adapter 层（`rest/app.ts`）手写一个绕过 registry 的路由。理由：绕过 registry 的能力无法被 MCP/SKILL 派生，会造成「REST 有、Agent 没有」的入口分裂——这正是融合前 deepcard-v2 想解决的问题。

添加一个 operation = 3 步：
1. 定义 Zod Schema（`schemas/*.schema.ts`）
2. 实现 Service 方法（`services/*.service.ts`）
3. 注册到 Registry（`shared/operations.ts`）

### 2. Service 层零协议依赖
Service **不得** import hono / registry / 任何 HTTP 概念。方法签名统一 `(db, userId, input) => Promise<ServiceResult<T>>`。需要 env（如 LLM 配置）时，由 adapter 经 `ctx` 注入（见 `OperationContext.llm`），service 接收解析好的配置，而不是自己读 `process.env`。

### 3. 统一数据流：校验 → 所有权 → 操作 → ServiceResult
每个 service 方法内部顺序固定：
1. **Zod 校验**（在 adapter 层用 `op.inputSchema.safeParse` 完成）
2. **userId 所有权检查**：凡涉及已有资源，先 `where(and(eq(id), eq(userId)))` 确认归属，缺失返回 `err('NOT_FOUND', ...)`。**绝不允许跨用户读写。**
3. **Drizzle 操作**
4. 返回 `ok(data)` 或 `err(code, message)`，由 adapter 映射成协议响应（HTTP 状态码见 `shared/errors.ts`）。

### 4. Adapter 轻量、统一包络
REST adapter 对所有 operation 一视同仁：统一 `{ data }` / `{ error: { code, message } }` 包络，统一错误码→状态码映射。不在 adapter 写任何 operation 特定的业务分支。

### 5. Schema 改动走 Drizzle 迁移
改 `db/schema.ts` 后必须 `pnpm db:generate`（生成 migration）→ 应用到 Supabase。不手改数据库。`cards` 表的 FSRS 字段（stability/difficulty/due/reps/lapses/state）是 ts-fsrs 调度的契约，改动需同步 SRS 模块。

## 当前已注册的 operation（截至融合阶段 2）

| category | operations |
|----------|------------|
| decks | create / update / delete / get / list / reorder |
| cards | create / create_batch / update / delete / get / list_by_deck / suspend / search / **generate**（LLM 生成，autoSave 落库）|
| llm | list_providers / test_connection / generate_text |

## 入口派生路线（用户需求：网页 + 插件 + agent）

- **REST**：已实现（`adapters/rest/app.ts` 遍历 registry 自动注册 Hono 路由）。
- **MCP server**：规划中。从 registry 派生 MCP tools（`name` → tool 名，`description` → tool 描述，`inputSchema` → JSON Schema，`execute` → handler）。让 Claude/Cursor 等直接调用。
- **SKILL.md**：规划中。从 registry 派生 skill 描述，让 Claude Code 以 skill 形式使用。
- **OpenAPI**：规划中。`generated/openapi.json`。
- **浏览器插件**：规划中。直接调 REST（用 API Key 认证，需先实现 `Bearer dc_` 认证，当前 501）。

> `Operation` 的 `description` / `category` / `scope` 字段正是为这些派生器预留的接入点。新增 operation 时认真填写这三个字段，MCP/SKILL 派生器会直接消费它们。

## 认证

- Web SPA：Supabase Auth (JWT) — 后端校验逻辑已就位（`auth.ts`），前端登录页待接。
- AI Agent / 浏览器插件：API Key（`Bearer dc_xxxxx`，当前 501 待实现）。
- Dev mode：`X-Dev-User-Email` header / `DEV_USER_EMAIL` env（开发期默认）。**多 worktree 并行用不同 dev email 实现数据隔离**（见 CLAUDE.md）。
