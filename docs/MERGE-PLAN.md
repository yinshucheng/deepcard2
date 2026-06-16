# DeepCard 三项目融合计划

> 目标:把 `deepcard`、`deepcard-v2`、`deepcard2` 三个项目的精华融合为**单一全 TS 项目**,最终只保留一个。

## 决策总览(已与用户对齐)

| 维度 | 决策 |
|------|------|
| 技术底座 | **deepcard-v2**(全 TS:Hono + Cloudflare Workers + Supabase + Drizzle + Operation Registry) |
| 后端语言 | 全 TypeScript(放弃 deepcard2 的 Python/FastAPI) |
| 数据库 | Supabase(Postgres) |
| 间隔重复算法 | **ts-fsrs**(deepcard-v2 schema 已预留 FSRS 字段) |
| 前端 | 沿用 deepcard-v2 的 Vite + React19 + TanStack Query + react-router(+ Capacitor iOS) |
| 凭证 | 拷贝 deepcard-v2 现有 `.env`(⚠️ 见安全提醒) |
| 删除策略 | 先归档(tar 备份)再删除 `deepcard` 和 `deepcard-v2` |
| 开发哲学 | Happy Path 优先、分阶段、每阶段有可运行测试(遵循 CLAUDE.md) |

## ⚠️ 安全提醒(用户已知悉并选择拷贝)

deepcard-v2 的 `.env` 含真实泄露凭证:Supabase 项目 `decvupmxbinhidwgebdj`、数据库密码明文、Moonshot/Kimi key。
拷贝后**强烈建议尽快在 Supabase / Moonshot 控制台轮换这些密钥**。另外原 `.env` 的 `SUPABASE_URL` 被错填为 postgres 连接串(应为 https URL),迁移时需修正。

---

## 各项目可复用资产清单

### 来自 deepcard-v2(技术底座,直接保留)
- ✅ Operation Registry(`shared/registry.ts` + `operations.ts`)——单源多协议派生架构
- ✅ Service 层契约(`ServiceResult` / `ok` / `err`,方法签名 `(db, userId, input)`)
- ✅ REST adapter 自动派生(`adapters/rest/app.ts`)
- ✅ Drizzle schema(10 表,FSRS 字段齐备)
- ✅ 认证中间件(Supabase JWT / Dev mode;API Key 是 501 待实现)
- ✅ 前端 Vite + React19 + TanStack Query + fetch 封装

### 来自 deepcard2(移植业务逻辑到 TS)
- 📦 LLM 抽象层:3 provider(OpenAI/DeepSeek/SiliconFlow,均 OpenAI 兼容)→ TS 合并为单一 OpenAI-兼容 provider + 配置区分
- 📦 重试退避:`min(2^attempt, 10)` 秒,最多 4 次调用(移植时生成路径也用上重试)
- 📦 4 种卡片生成 prompt 模板(basic/cloze/qna/concept,中文原文已提取)
- 📦 JSON 解析容错:贪婪正则 `/\{[\s\S]*\}/` + 逐卡片 try/skip
- 📦 配置化测试系统(TestMode 4 档 + 3 开关双重门控,省 LLM 账单)
- 📦 里程碑文档体系(milestone-N.md 计划型 + milestone-N-acceptance.md 验收型 + Happy Path 用例)

### 来自 deepcard(移植 UI / 算法 / 打包)
- 🎨 FlashCard 3D 翻转组件(标准 CSS transform → Tailwind,可近原样)
- 🎨 StudyDeck 学习流程骨架(进度条 / 索引推进 / 完成态;评分钩子接 ts-fsrs)
- 🎨 AI 生成页交互(表单 + 卡片预览)
- 📱 Capacitor iOS 打包(Capacitor 7,iOS 原生工程框架无关,可复用)
- ❌ SM-2 算法不用(改用 ts-fsrs);改进型 level 模型仅作参考

---

## 分阶段实施计划(每阶段有 Happy Path 验收)

> 说明:在新基座(deepcard-v2 代码)上分阶段叠加功能。每阶段结束都要能 `pnpm dev` 跑起来并通过该阶段的 happy path 测试,再进入下一阶段。

### 阶段 0:建立单一项目基座(归档 + 迁移底座)
1. 归档:`tar` 备份 `deepcard` 与 `deepcard-v2` 到 `~/code/creo/_archive/`(或确认已推远端)。
2. 把 deepcard-v2 的代码迁移为新的 deepcard2 后端基座:
   - 在当前 `deepcard2` 目录引入 monorepo 结构(`packages/api`、`packages/web`),或直接采用 deepcard-v2 的 monorepo 布局。
   - 拷贝 `.env`(并修正 SUPABASE_URL,标注待轮换密钥)。
   - 保留 deepcard2 的 `docs/`、`ROADMAP.md`、`CLAUDE.md` 里程碑文档体系。
   - **删除/归档** deepcard2 的 Python `backend/`(逻辑已提取,见下文移植)。
3. **Happy Path 0**:`pnpm install` → `pnpm db:generate && pnpm db:push`(连 Supabase)→ `pnpm dev:api` 起 worker → `curl /api/health` 返回 200;`pnpm dev:web` 起前端,decks 列表页能加载(dev mode 认证)。

### 阶段 1:补齐 deck/card CRUD 闭环 + 修复已知缺口
1. 修复 deepcard-v2 遗留问题:
   - 前端 `lib/api.ts` 补发 `X-Dev-User-Email` header(当前完全不发认证头)。
   - `search_cards` 路由顺序冲突(`/cards/search` vs `/cards/:cardId`)校验/修正。
   - deck list 的 N+1 查询暂记 TODO(happy path 阶段不优化)。
2. 生成首个 Drizzle migration 并 push 到 Supabase。
3. **Happy Path 1**:创建 deck → 在 deck 下增删改查 card → 列表/搜索 card,全部经 REST 跑通(curl + 前端两条路径)。Vitest service 层测试通过。

### 阶段 2:移植 LLM 集成 + 文本生成卡片(deepcard2 核心资产)
1. 新建 `packages/api/src/llm/`:
   - `provider.ts`:单一 OpenAI-兼容 provider(base_url/model/key 配置化),内置 `generateWithRetry`(`min(2^attempt,10)*1000` ms,最多 4 次)。
   - `factory.ts`:注册 openai / deepseek / siliconflow / moonshot(kimi) 的 base_url + 默认 model + 支持列表。
   - `prompts.ts`:4 种卡片类型 prompt 模板(中文原文 1:1)。
   - `parser.ts`:JSON 容错解析(贪婪正则 + 逐卡片 try/skip)。
2. 新增 Operations(注册到 registry,自动派生 REST):
   - `list_llm_providers`(GET /llm/providers)
   - `test_llm_connection`(POST /llm/test)
   - `generate_text`(POST /llm/generate)
   - `generate_cards`(POST /cards/generate,支持 `auto_save` 落库)
3. 前端:移植 deepcard 的 AI 生成页(表单:text、card_type、provider、max_cards、auto_save → 预览生成卡片 → 可保存到 deck)。
4. **Happy Path 2**:`POST /cards/generate {text, card_type:"basic", max_cards:3}` 返回 3 张结构化卡片;`auto_save:true` 时落库可在 deck 中查到。配置化测试:`ENABLE_LLM_TESTS` 关闭时跳过真实调用(用 mock provider)。

### 阶段 3:学习闭环 + ts-fsrs 间隔重复(融合三方核心)
1. 后端新增 `packages/api/src/srs/scheduler.ts`:封装 ts-fsrs,输入(card 当前 FSRS 状态 + rating 1-4)→ 输出(更新后的 stability/difficulty/due/reps/lapses/state + review_log)。
2. 新增 Operations:
   - `get_due_cards`(GET /decks/:deckId/study,按 due 排序取到期卡)
   - `review_card`(POST /cards/:cardId/review,body `{rating}`,跑 ts-fsrs + 写 review_logs + 更新 card)
   - `start_study_session` / `complete_study_session`(study_sessions 表)
3. 前端移植 deepcard 学习 UI:
   - FlashCard 3D 翻转组件(Tailwind 重写,先 front 点翻 back)
   - StudyDeck 页面(进度条 + 4 档评分 Again/Hard/Good/Easy → 调 `review_card` → 推进 → 完成态)
4. **Happy Path 3**:进入 deck 学习 → 取到期卡 → 翻卡评分 → ts-fsrs 调度生效(due 更新、review_log 落库)→ 学完显示完成。

### 🎯 三种入口形态(用户需求:网页 + 浏览器插件 + agent 调用)

> 全部基于 Operation Registry —— 一套 operations 派生多种入口,业务逻辑只写一遍。
> **顺序决策(已与用户对齐)**:skill/mcp 先行,但先补 LLM 生成操作让 registry 有高价值能力 → 再派生 MCP/SKILL → 然后网页补完 → 最后插件。

**入口 A — Agent 调用(skill/mcp 先行)**:阶段 2 后立即做。从 registry 派生:
- **MCP server**(让 Claude/Cursor 等客户端直接调用 deepcard 操作)
- **SKILL.md**(让 Claude Code 等以 skill 形式使用)
- 此时 agent 能调用的不只是 CRUD,还有"从文本生成卡片并保存"这个核心操作。

**入口 B — 网页版**:阶段 1/2/3 累积完成(decks/卡片 CRUD + LLM 生成 + ts-fsrs 学习闭环)。

**入口 C — 浏览器插件**:阶段 6。两个核心场景:
- 划词/选中文本 → 调 `generate_cards` → 存入指定 deck
- 一键抓取整页正文 → 生成多张卡片,卡片回溯原页 URL(`source_url` 字段已在 schema)
- 插件直接调后端 REST API(用 API Key 认证,需先实现 `Bearer dc_` 认证,当前 501)

### 阶段 4(可选):iOS 打包
- Capacitor iOS:前端配静态产物 → `cap sync` → 真机/模拟器跑通(改 appId 为真实 bundle id)。

### 阶段 5:清理删除
1. 确认归档完成 + 新项目阶段 1-3 happy path 全绿。
2. 删除本地 `deepcard` 和 `deepcard-v2` 目录。
3. 更新 deepcard2 的 README/ROADMAP/CLAUDE.md 反映新技术栈(全 TS / Hono / Supabase / ts-fsrs)。

---

## 进度记录
- ✅ **阶段 0**:归档三项目 + 迁移 deepcard-v2 TS 底座 + Happy Path 0(health 200 + Supabase decks CRUD 端到端)。Supabase 项目恢复后用 **pooler 连接**(直连 host DNS 不可达)。db schema 已存在(deepcard-v2 时期 push 过),migration 生成于 `src/db/migrations/0000_*.sql`。
- ✅ **阶段 2**:LLM 集成。新增 `src/llm/`(provider+factory+prompts+parser+errors)+ `src/services/llm.service.ts` + `src/schemas/llm.schema.ts`。注册 4 个 operations:`list_llm_providers` / `test_llm_connection` / `generate_text` / `generate_cards`(autoSave 落库)。Operation ctx 扩展了 `llm` 配置(env 注入)。Happy Path 2 通过:真实 Moonshot Kimi 生成 + autoSave 落库端到端验证。测试 22/22 通过。

## 风险与注意点
1. **凭证泄露**:拷贝 .env 后尽快轮换 Supabase / Kimi 密钥;修正 SUPABASE_URL 格式。
7. **Moonshot kimi 只接受 temperature=1**:provider 默认 temperature 已设为 1(兼容);其他模型如需更低需在请求显式传。
8. **`.dev.vars` 是 worker 实际读取的 env**(不读根 .env),LLM_* 配置已补入。drizzle-kit 用根 .env。
9. **GET query 数字参数必须用 `z.coerce.number()`**:query string 都是字符串,`z.number()` 会 400(已修 `list_cards_by_deck` / `search_cards` 的 limit/offset)。POST body 的 number 不受影响。
10. **前端 dev 体验**:`pnpm dev`(根)同时起 8787 worker + 5173 vite。前端 fetch 不带认证头,靠后端 dev mode `DEV_USER_EMAIL` 兜底 = dev 用户。接入 Supabase Auth 登录后改为带 JWT。
2. **Cloudflare Workers 本地调试**:每请求新建 postgres 连接(无连接池),开发期可接受,生产需评估。
3. **CardType.cloze 命名**:deepcard2 枚举成员名小写不一致,TS 统一为字符串值 `"cloze"`。
4. **生成未走重试**:deepcard2 原实现生成路径未用 retry,TS 版修正为带重试。
5. **Next.js vs Vite**:已决定弃用 deepcard2 的 Next.js,统一用 deepcard-v2 的 Vite(Capacitor 友好)。前端营销页/test-api 页如需保留可移植成 React 组件。
6. **分阶段铁律**(CLAUDE.md):每阶段必须有 happy path 测试通过才进入下一阶段,不过度抽象。

---

## 最终目录形态(预期)
```
deepcard2/                      # 唯一保留的项目
├── packages/
│   ├── api/                    # Hono + Drizzle + Operation Registry (TS)
│   │   └── src/{shared,services,adapters,db,schemas,llm,srs,entry}
│   └── web/                    # Vite + React19 + TanStack Query (+ Capacitor)
├── docs/                       # 沿用 deepcard2 里程碑文档体系
├── ROADMAP.md / CLAUDE.md
├── .env / .env.example
├── pnpm-workspace.yaml
└── package.json
```
