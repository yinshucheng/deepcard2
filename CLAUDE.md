# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么

DeepCard 🃏 —— 一个 **Agent-first** 的 AI 闪卡应用。核心理念：闪卡操作（创建、复习、导入、**从文本/网页生成**）既可以通过 Web/插件 UI 完成，也可以被 AI Agent 通过 **MCP / REST / SKILL** 直接调用——AI Agent 与人类用户是平等的一等公民，共享同一套经过校验、带所有权检查的业务操作。

从博客、文章、书籍等内容源用 LLM 自动生成学习卡片，卡片可回溯原始资源（`sourceUrl`），并配合 FSRS 间隔重复做科学复习。

> 📌 本项目由 `deepcard` / `deepcard-v2` / `deepcard2` 三个早期项目融合而来，技术底座取自 deepcard-v2（全 TS），LLM 生成逻辑取自 deepcard2，学习 UI/iOS 取自 deepcard。融合的分阶段计划与进度见 **`docs/MERGE-PLAN.md`**。

## 技术栈（全 TypeScript / pnpm monorepo）

| 组件 | 技术 |
|------|------|
| 后端 | Hono on Cloudflare Workers（`packages/api`）|
| 前端 | Vite + React 19 + Tailwind + TanStack Query + react-router（`packages/web`）|
| 数据库 | Supabase (Postgres + Auth) |
| ORM | Drizzle |
| SRS | FSRS（`ts-fsrs`，schema 字段已就位，调度待接）|
| 校验 | Zod |
| LLM | OpenAI 兼容多厂商（OpenAI / DeepSeek / SiliconFlow / Moonshot-Kimi）|
| Agent 入口 | MCP + SKILL + OpenAPI（从 Operation Registry 派生，规划中）|

## 命令

```bash
pnpm install                 # 用 pnpm，不是 npm（monorepo, pnpm@9.15.4）

pnpm dev                     # 同时起 api(wrangler:8787) + web(vite:5173)
pnpm dev:api                 # 只起后端 worker（wrangler dev, :8787）
pnpm dev:web                 # 只起前端（vite, :5173，proxy /api → 8787）

pnpm test                    # Vitest（api 包）
pnpm lint                    # tsc --noEmit 类型检查（api + web）
pnpm build                   # 构建 api + web

# 数据库（Drizzle → Supabase）
pnpm db:generate             # 改 schema.ts 后生成 migration
pnpm db:migrate              # 应用 migration（用 .env 的 DATABASE_URL）
pnpm db:studio               # Drizzle Studio
```

验证靠：`pnpm test` 通过 + `pnpm lint` 通过 + `curl` 打接口 + 浏览器实测。

### ⚠️ 环境变量分两处，别搞混

- **`packages/api/.dev.vars`** —— **wrangler dev 实际读取的 env**（worker 运行时）。含 Supabase + LLM 凭证。改它要重启 worker。
- **根 `.env`** —— **drizzle-kit 读取**（`db:*` 命令）。两份的 Supabase/LLM 值应保持一致。
- 两者都在 `.gitignore`，含真实凭证。⚠️ 凭证从 deepcard-v2 迁移而来、曾本地明文暴露，建议尽快在 Supabase/Moonshot 控制台轮换。
- `.env.example` 是给人看的占位模板。

### ⚠️ Supabase 连接用 pooler，不用直连

直连 host `db.<ref>.supabase.co:5432` 在本项目 DNS 不可达；用 pooler 串 `postgres.<ref>@aws-...-pooler.supabase.com:6543`。

## 架构大图

> 📌 **文档同步是硬规则**：当你改动了架构、数据流、状态语义，或纠正了本文档/spec 里某个不准确的认知，**必须在同一次改动里把 `CLAUDE.md` / 对应 `specs/` / 相关代码注释一起改齐**。下游每个 session 都靠这份文档建立认知，文档错一句，后面所有人跟着错。改完问自己：「按这份文档重建认知，会不会被误导？」

**核心架构基线见 `specs/000-architecture.md`，不可违反。** 一句话：

> 业务逻辑只写一遍（Service），通过 **Operation Registry** 注册一次，自动派生多入口（REST / MCP / SKILL）。

```
入口(Adapters, 从 registry 派生, 无业务逻辑)
   REST(adapters/rest/app.ts) │ MCP(规划) │ SKILL(规划)
        │ 遍历 registry.getAll()
Operation Registry(shared/registry.ts + operations.ts)
   每个 op: name/description/category/inputSchema(Zod)/execute/rest/scope
        │ execute(input, ctx{userId, db, llm})
Service 层(services/*.ts) —— 零协议依赖, 签名 (db,userId,input)=>ServiceResult
        │ Drizzle
Supabase Postgres(db/schema.ts, 10 表, cards 含 FSRS 字段)
```

### 添加一个能力 = 3 步（不要绕过 registry）

1. 定义 Zod Schema（`packages/api/src/schemas/*.schema.ts`）
2. 实现 Service 方法（`packages/api/src/services/*.service.ts`），签名 `(db, userId, input) => Promise<ServiceResult<T>>`
3. 注册到 Registry（`packages/api/src/shared/operations.ts`）

REST 路由会**自动派生**，无需手写。绕过 registry 手写路由 = 该能力无法被 MCP/SKILL 派生，造成入口分裂——这是禁止项（见 `000-architecture.md` 规则 1）。

### 数据流铁律（每个 service 方法内部）

**Zod 校验 → userId 所有权检查 → Drizzle 操作 → ServiceResult**。涉及已有资源必先 `where(and(eq(id), eq(userId)))` 确认归属，缺失返回 `err('NOT_FOUND')`。**绝不跨用户读写。**

### LLM 模块（`packages/api/src/llm/`）

单一 OpenAI 兼容 provider（`provider.ts`，含 `generateWithRetry`：退避 `min(2^a,10)`s、最多 4 次）+ 厂商目录（`factory.ts`）+ 4 种卡片 prompt（`prompts.ts`：basic/cloze/qna/concept）+ JSON 容错解析（`parser.ts`：贪婪正则 + 逐卡 try/skip）。LLM 配置经 `OperationContext.llm` 从 worker env 注入，service 不直接读 env。

> 坑：Moonshot kimi 只接受 `temperature=1`（provider 默认已设 1）。GET query 数字参数必须用 `z.coerce.number()`（query 是字符串，`z.number()` 会 400）。

### 前端（`packages/web`）

React 19 + Vite。`App.tsx` 路由；`lib/api.ts` 用 fetch 封装（解包 `{data}`）；TanStack Query 管数据。当前前端 fetch **不带认证头**，靠后端 dev mode `DEV_USER_EMAIL` 兜底（= dev 用户）。接 Supabase Auth 登录后改为带 JWT。

## 认证

- Web：Supabase Auth (JWT)，后端校验逻辑已就位（`auth.ts`），前端登录页待接。
- Agent / 浏览器插件：API Key（`Bearer dc_`，当前 501 待实现）。
- Dev mode：`X-Dev-User-Email` header / `DEV_USER_EMAIL` env（开发期默认）。

## 状态与配置存放（关键约束）

- **数据** → Supabase（共享，不在仓库）。
- **凭证** → `packages/api/.dev.vars`（worker）+ 根 `.env`（drizzle）。**只存这两处，绝不入库、不硬编码、打印脱敏。**
- 改 `db/schema.ts` → 必须 `pnpm db:generate` 生成 migration，不手改数据库。

## 开发流程

> 🧭 **会落地成代码的特性默认走「spec → `wt.sh impl` → worktree」，别在 main 工作区直接写实现代码。** 设计期在 main 写 `specs/NNN-<slug>.md`（纯文档不污染），定稿置 `accepted` 后 `scripts/wt.sh impl NNN` 一键开隔离 worktree 实现。只有「单文件 bugfix / 笔误 / 纯文档」才直接在 main 上做。

> **改了架构或认知，必须同步文档——和代码一起改，别留到「之后」。** 判据：「读者照着旧描述会被误导吗？」会，就得改（`CLAUDE.md` / `specs/` / 代码注释）。

### 大特性 / 起点干净 → spec 驱动

动手前先在 `specs/NNN-<slug>.md` 写规格（背景/目标/验收标准/技术方案/任务拆解），定稿确认再实现。**接到需求时先读 `specs/README.md`**（工作流 + 状态约定）和 `specs/000-architecture.md`（不可违反的架构基线）。`.plans/` 放实现期临时笔记（可丢）。

每个特性遵循「**Happy Path 优先、分阶段**」（全局开发哲学）：每个阶段都要有 happy path 测试通过，再进入下一阶段；不过度抽象。

### Bugfix / 小改动 → 观测驱动 + 回归测试

主线：复现 → 定位根因 → 在根因层写一个会失败的测试(red) → 修复 → 测试通过(green) → 留存防回归。

硬规则：

1. **先观测后动手**：用一条证据（`curl` 打接口 / `node -e` 跑函数 / 浏览器 DevTools 查 DOM/网络）钉死现象，确认 bug 真存在，再改。没有观测不动手。
2. **追到根因层**：显式回答「这是症状还是根因？」，测试写在根因层（如「`/cards` 列表显示 0 张」根因是 schema `z.number()` 拒绝了 query 字符串，断言应打在 schema/接口层，不是某个 DOM 节点）。
3. **一次只改一个变量**，改完立即观测。
4. **验证打在真实运行路径上**：`pnpm build` 成功 ≠ 验证通过；改后端记得重启 worker。
5. **每个 bugfix 配一条回归断言**，加进 `packages/api/src/**/__tests__/`。

## 多特性并行开发

多个**基本独立**的特性同时推进时，用 `git worktree` 强隔离：每个特性一个独立目录 + 分支 + **端口对(api+web)** + **独立 dev 用户**，代码互不污染、进度互不丢失。脚本 `scripts/wt.sh`。

### 标准流程：一条特性的一生

```
设计期: 在 main 写 specs/NNN-<slug>.md（纯文档，不碰代码）→ 与用户定稿 → 状态置 accepted
实现期: scripts/wt.sh impl NNN     # 按 spec 编号一键开实现 worktree：
                                   #   从文件名派生 slug → 建 .worktrees/<slug> + 分支 feat/<slug>
                                   #   + 分配端口对(api/web) + 拷 .dev.vars（DEV_USER_EMAIL 改隔离值）
                                   #   + pnpm install + worktree 内 spec 置 in-progress
        cd .worktrees/<slug> && 专心实现，与 main 及其他 worktree 互不干扰
合并期: git rebase origin/main → pnpm test + pnpm lint 通过 → 合回 main → spec 置 done
收尾:   scripts/wt.sh rm <slug>    # 移除 worktree（脏则拒绝）
```

**为什么设计期留在 main**：spec 是 `.md`，不碰代码、不串台，放 main 才能被所有 session 读到、好讨论。真正会互相污染的是实现代码，所以 worktree 在 `impl` 时才开。

### 命令速查

```bash
scripts/wt.sh impl 001             # 【首选】按 spec 001 一键开实现 worktree
scripts/wt.sh new spike-xyz        # 无 spec 的探索性特性：直接按 slug 开
scripts/wt.sh list                 # 看所有 worktree：分支 / 端口对 / 是否在跑
cd .worktrees/<slug>
../../scripts/wt.sh serve          # 后台起 api+web（缺依赖自动 install），日志在 .wt-*.log
../../scripts/wt.sh restart        # 改后端后只重起「这个」worktree 的 api+web
../../scripts/wt.sh stop           # 停掉这个 worktree
../../scripts/wt.sh rm <slug>      # 干完移除（有未提交/未合并改动会拒绝，需 --force）
```

**为什么这套能行（项目特有约束）**：

- **端口对隔离**：主目录恒用 api=8787/web=5173；worktree 第 k 个用 api=8800+k·10 / web=5180+k·10，记在 `.wt-ports`（gitignore）。vite 经 `VITE_API_PORT/VITE_DEV_PORT` env 注入端口，wrangler 经 `--port` + `--var`。
- **数据隔离靠 dev 用户**：所有 worktree 共享同一 Supabase，但每个用独立 `DEV_USER_EMAIL=dev+<slug>@deepcard.app`。数据按 `userId` 天然隔离，零成本。不隔离数据库本身（共享 schema 本就该一致）。
- **凭证共享**：`.dev.vars` 从主目录拷一份到 worktree（仅改 DEV_USER_EMAIL），同一套 Supabase/LLM 凭证。

**硬规则**：

1. **改 worktree 的后端，用 `wt.sh restart` 不用 `pkill -f wrangler`**——后者会杀掉所有 worktree 的 worker。
2. **每个 worktree 开工前、合并前各 `git rebase origin/main` 一次**，减小漂移。
3. **合并前在该 worktree 跑 `pnpm test` + `pnpm lint` 通过**。
4. **新建 spec 前先 `ls specs/` 看最大编号**——并行时编号易撞，撞了往后顺延，别覆盖。
5. 若两特性碰了同一核心文件（`registry.ts`/`operations.ts`/`schema.ts`），**先合冲突小的，后者 rebase 吸收前者**。

## 测试

Vitest（`packages/api`）。测试文件放 `src/**/__tests__/*.test.ts`。**只为「修过的 bug」和「核心不变量」写测试**，不追覆盖率——半年下来 `__tests__/` 就是这个项目踩过的坑的可执行清单。

**配置化测试**（避免 LLM 账单）：用环境变量开关控制是否真实调用 LLM/DB/外部 API。某类测试真跑 = 开关 true **AND** mode 在允许档位内（双重门控）。LLM 单元测试用 mock fetch，不打真实 API。

## Git 管理规范

- 里程碑/阶段完成前先与用户确认是否推送远端。
- 提交格式：`feat(phase-X): 描述` / `feat(NNN-slug): 描述` / `fix: 描述`。
- 推送前确保 `pnpm test` + `pnpm lint` 通过。
