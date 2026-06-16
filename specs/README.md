# Specs — DeepCard 规格驱动开发

本目录是 DeepCard 的**单一事实来源（source of truth）**。会落地成代码的特性，动手前先在这里写一份 spec：把「要做什么、做到什么算完成、怎么做、拆成哪几步」想清楚并定稿，再实现。

## 为什么 spec 驱动

- DeepCard 的核心是 **Operation Registry**（一套 operation 派生 REST / MCP / SKILL 多入口）+ 协议无关的 Service 层。新特性必须先对齐「要新增哪些 operation、schema、service」，否则容易绕过 registry、污染内核。
- 会话经常被压缩/中断。spec 是跨 session 的锚点：任何新 session 读 `specs/` 就能接上下文，不依赖对话记忆。
- 验收标准前置，避免「做完了但不是想要的」。配合「Happy Path 优先、分阶段」的开发哲学。

## 什么时候必须写 spec

> **凡是会落地成代码改动的特性，先写 spec 再实现，且实现走 worktree（见 CLAUDE.md「多特性并行开发」）。**

- ✅ **要写**：新功能、新 operation、schema 改动、跨多文件的重构、改动架构/数据流。
- ❌ **不用写**：单文件 bugfix、笔误、纯文档更新、依赖升级——这类直接在 main 上做。

## 工作流

1. **提案**：复制 `TEMPLATE.md` → `specs/NNN-<slug>.md`，状态填 `proposed`。编号三位数递增（新建前先 `ls specs/` 看最大号，并行时编号易撞，撞了往后顺延，别覆盖）。
2. **定稿**：补齐需求、验收标准（Happy Path 用例）、技术方案、任务拆解。与用户确认后状态改 `accepted`。
3. **实现**：`scripts/wt.sh impl NNN` 一键开隔离 worktree（spec 自动置 `in-progress`）。按「任务拆解」逐项做；临时笔记放 `.plans/`（短期可丢），spec 本身只记最终决策。
4. **完成**：全部验收标准勾掉 + `pnpm test`/`pnpm lint` 通过后，状态改 `done`，在「实现记录」里留下落地的文件/提交。
5. **变更**：已 `done` 的 spec 若要改，不直接覆写——新开一份 spec 引用它（`Supersedes: NNN`），保留演进轨迹。

## 状态约定

| 状态 | 含义 |
|------|------|
| `proposed` | 已登记，尚未细化/确认 |
| `accepted` | 已定稿，可以开工（`wt.sh impl`）|
| `in-progress` | 正在实现（worktree 内）|
| `done` | 已落地并通过验收 |
| `superseded` | 被更新的 spec 取代 |

## 目录

| 编号 | 标题 | 状态 | 优先级 |
|------|------|------|:---:|
| [000](000-architecture.md) | 架构基线：Operation Registry + 协议无关 Service 层 | accepted | — |

> 编号 ≠ 实现顺序。优先级与实际排期由用户定。
> 阶段性进度（融合三项目 → 全 TS）记录在 `docs/MERGE-PLAN.md`。

## 相关文档

- `CLAUDE.md` — 项目配置、架构大图、开发流程（每个 session 必读）
- `docs/MERGE-PLAN.md` — 三项目融合的分阶段计划与进度
- `ROADMAP.md` — 产品里程碑路线图
- `.plans/` — 实现期的临时笔记（短期、可丢）
