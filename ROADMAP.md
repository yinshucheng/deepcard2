# DeepCard 路线图

> 产品级愿景与阶段。**具体待开发功能清单见 `docs/DEV-PLAN.md`**（spec 的上游）；
> 融合迁移进度见 `docs/MERGE-PLAN.md`；架构基线见 `specs/000-architecture.md`。

## 🎯 愿景

一个 **Agent-first** 的 AI 闪卡应用：从文章/网页/书籍用 LLM 自动生成学习卡片（可回溯原始资源），配合 FSRS 间隔重复做科学复习。闪卡操作既能在 Web/插件里由人完成，也能被 AI Agent 通过 MCP/REST/SKILL 调用。

## 📍 阶段

| 阶段 | 主题 | 状态 |
|------|------|------|
| **基座** | 全 TS 重写：Hono + Supabase + Operation Registry + LLM 生成 | ✅ 已完成（见 MERGE-PLAN）|
| **MVP 闭环** | 登录 + 网页生成卡片 + 学习复习(ts-fsrs) + 网页可用 | 🚧 规划中（F-01~F-04）|
| **多入口** | API Key + MCP + SKILL + OpenAPI + 浏览器插件 | 📋 规划中（F-05~F-09）|
| **内容增强** | URL 抓取 / Anki·CSV 导入导出 / 学习统计 / 卡片类型渲染 | 📋 规划中（F-10~F-13）|
| **平台协作** | 牌组分享 / iOS / 多 LLM 管理 / 富媒体 | 📋 远期（F-14~F-17）|

## 📝 开发原则

1. **Happy Path 优先**：先实现核心主流程，后补边界情况，不过度防御。
2. **分阶段、每阶段有 happy path 测试**：测试通过再进下一阶段，不过度抽象。
3. **spec 驱动 + 多特性并行**：会落地成代码的特性先写 spec，再用 worktree 隔离实现（见 `CLAUDE.md`）。
4. **Agent-first**：能力一律注册为 operation，从 registry 派生多入口，不绕过 registry。
5. **以 LLM 生成为核心价值**。
