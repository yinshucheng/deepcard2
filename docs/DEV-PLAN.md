# DeepCard 开发规划（功能路线图）

> 本文档是**待开发功能的上游清单**，是 `specs/` 的来源。每个功能项成熟后转成一份 `specs/NNN-<slug>.md`（按 `specs/README.md` 工作流），可逐个或并行（`scripts/wt.sh impl`）开发。
>
> - 编号 `F-NN` 是功能编号（≠ spec 编号，转 spec 时另取三位数 spec 号并在此处回填）。
> - 状态：`planned`（已规划未开工）/ `spec`（已写 spec）/ `in-progress` / `done`。
> - 优先级与排期由用户定；下面的「近/中/远」是建议分档，不是硬顺序。

## 当前已落地（基线，不在待办内）

- ✅ 全 TS 基座：Hono + Cloudflare Workers + Drizzle + Supabase + Operation Registry
- ✅ deck/card CRUD（14 个 operations）+ 搜索 + 分页
- ✅ LLM 集成：4 厂商 + 重试 + 4 种卡片 prompt + 容错解析
- ✅ `generate_cards` operation（文本生成卡片，autoSave 落库，sourceUrl 回溯）
- ✅ 网页基础：decks 列表 + deck 详情（卡片 CRUD），dev mode 免登录
- ✅ 数据库 10 表（cards 含完整 FSRS 字段，待接调度）
- ✅ 开发体系：spec 驱动 + worktree 并行（`scripts/wt.sh`）

> 详细进度见 `docs/MERGE-PLAN.md`。架构基线见 `specs/000-architecture.md`。

---

## 🎯 MVP 最小闭环（近期）

目标：**让产品「能真正用起来」** —— 登录、生成、学习复习、网页可用，四块连成闭环。建议按此顺序，因为后者依赖前者。

| 功能 | 说明 | 优先级 | 依赖 | spec |
|------|------|:---:|------|:---:|
| **F-01 Supabase Auth 登录** | 前端登录页（邮箱密码 / Magic Link）+ JWT 注入 API 请求 + 关掉 dev 兜底。后端校验逻辑已就位（`auth.ts`）。 | ★ 高 | — | — |
| **F-02 网页「AI 生成卡片」页** | 前端接 `generate_cards` operation：输入文本 + 选卡片类型/数量 → 预览生成卡片 → 选 deck 保存。这是核心价值的网页入口。 | ★ 高 | F-01 | — |
| **F-03 学习闭环 + ts-fsrs 调度** | 后端：`get_due_cards` / `review_card`（跑 ts-fsrs 更新 FSRS 字段 + 写 review_logs）/ study_session operations。前端：翻卡组件 + 4 档评分（Again/Hard/Good/Easy）+ 进度。闪卡 App 的灵魂。 | ★ 高 | — | — |
| **F-04 网页体验补全** | deck 封面色 / 排序、卡片标签筛选 UI、空态/加载/错误态、移动端适配。让网页从「能跑」到「好用」。 | 中 | F-01~F-03 | — |

> F-01/F-02 与 F-03 基本独立，**可并行**两个 worktree。F-04 收口，放在最后。

---

## 🔌 多入口扩展（中期）

目标：兑现「Agent-first / 多入口」定位。三种入口都从 Operation Registry 派生，业务逻辑零重写。

| 功能 | 说明 | 优先级 | 依赖 | spec |
|------|------|:---:|------|:---:|
| **F-05 API Key 认证** | 实现 `Bearer dc_` 认证（当前 501）：生成/存储/校验 API key（`api_keys` 表已就位）。是插件和 agent 调用的前提。 | ★ 高 | — | — |
| **F-06 MCP server** | 从 registry 派生 MCP tools，让 Claude/Cursor 等客户端直接调用 deepcard 操作（含生成卡片）。`description`/`category`/`scope` 字段已为派生预留。 | ★ 高 | F-05 | — |
| **F-07 SKILL.md 派生** | 从 registry 生成 SKILL.md，让 Claude Code 以 skill 形式使用 deepcard。 | 中 | F-06 | — |
| **F-08 OpenAPI 派生** | 从 registry 生成 `generated/openapi.json`，供 agent/插件按 HTTP 契约调用。 | 中 | F-05 | — |
| **F-09 浏览器插件** | ① 划词/选中文本 → `generate_cards` 存入指定 deck；② 一键抓取整页正文 → 生成多卡，回溯原页 URL。直接调 REST（用 F-05 的 API Key）。 | ★ 高 | F-05 | — |

> F-05 是 F-06/F-08/F-09 的共同前置，应先做。F-06/F-07/F-08 互相独立可并行。

---

## 📚 内容与学习增强（中期偏后）

| 功能 | 说明 | 优先级 | 依赖 | spec |
|------|------|:---:|------|:---:|
| **F-10 URL 抓取生成** | 后端 operation：传 URL → 抓正文（`readability` 类库）→ `generate_cards`。网页/插件共用。 | 中 | — | — |
| **F-11 Anki / CSV 导入导出** | `import_jobs` 表已就位。导入 .apkg/.csv → 建卡；导出 deck 为 Anki/CSV。降低迁移门槛。 | 中 | — | — |
| **F-12 学习统计 / 仪表盘** | 复习热力图、留存曲线、每日新卡/复习量（`user_settings` 有 daily limit 字段）。 | 中 | F-03 | — |
| **F-13 多种卡片类型渲染** | 前端针对 cloze/qna/concept 做差异化渲染（填空挖空、概念卡示例列表等）。当前只渲染 front/back。 | 低 | F-03 | — |

---

## 🚀 平台与协作（远期）

| 功能 | 说明 | 优先级 | 依赖 | spec |
|------|------|:---:|------|:---:|
| **F-14 牌组分享** | `share_links` 表已就位。生成分享链接，他人可查看/复制牌组（`isPublic` 字段）。 | 低 | F-01 | — |
| **F-15 iOS 打包（Capacitor）** | 前端配静态产物 → `cap sync` → 真机。Capacitor 工程可复用 deepcard 旧资产。 | 低 | F-04 | — |
| **F-16 多 LLM provider 管理** | `llm_providers` 表已就位。用户在设置里配置自己的 provider/key/model，覆盖系统默认。 | 低 | F-01 | — |
| **F-17 富媒体卡片** | 卡片支持图片/音频（Supabase Storage）。 | 低 | F-01 | — |

---

## 转 spec 的建议节奏

1. **先做 MVP 闭环**（F-01~F-04）。建议 F-01+F-03 各开一个 worktree 并行，F-02 待 F-01 合并后做，F-04 收口。
2. **再做入口扩展**（F-05 先行，解锁 F-06/F-09）。
3. 内容增强（F-10~F-13）和远期（F-14~F-17）按用户实际需求插队。

> 转 spec 时：`ls specs/` 看最大编号 → 复制 `TEMPLATE.md` → 写 `specs/NNN-<slug>.md` → 定稿 `accepted` → `scripts/wt.sh impl NNN`。回填本表的 spec 列与状态。
