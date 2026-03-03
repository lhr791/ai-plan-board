# 🚀 AI 施工计划动态大纲 (AI Plan Board)

一个专门为 AI 施工、独立开发、运营活动策划等复杂项目打造的 **全栈动态进度看板**。
本项目基于现代化架构开发，支持极速丝滑的本地交互体验，并能将所有进度与计划严密、实时地上云同步。

## ✨ 核心特性

- **🌳 结构化三级树**：支持 `大板块 -> 核心骨干任务 -> 最细打点子计划 (Plan)` 的无限层次拆解。
- **⚡️ 极致乐观更新 (Optimistic UI)**：界面操作极速响应，状态变更瞬间完成，无需等待服务端网络请求（背后由 Next.js Server Actions 静默上云）。
- **📊 真实比例进度**：摒弃传统模糊的拖拽进度条。主任务的百分比完全由其下方“子计划(Plan)”的真实完成勾选数量严格计算而来。
- **🔒 GitHut Auth 与企业级隔离**：接入了 Supabase Auth 机制并开启极为严格的 Row Level Security (RLS)。你的看板只有你自己可见，团队成员登录只能看到自己负责的模块。
- **💼 无缝一键迁移**：支持从离线版本的 LocalStorage 状态完美热迁移上云。

## 🛠️ 技术栈

本项目基于以下前沿前端架构构建：

- **框架**: [Next.js 14](https://nextjs.org/) (App Router + Server Actions)
- **后端/数据库/认证**: [Supabase](https://supabase.com/) (PostgreSQL + RLS)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **图标**: [Lucide React](https://lucide.dev/)
- **部署推荐**: [Vercel](https://vercel.com/)

---

## 💻 本地开发指南

### 1. 克隆代码并安装依赖

```bash
git clone https://github.com/你的用户名/ai-plan-board.git
cd ai-plan-board
npm install
```

### 2. 配置环境变量

在项目根目录下创建一个 `.env.local` 文件，填入你的 Supabase 凭据：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```
*(注意：请确保你的 Supabase 项目中已经建立好了 `ai_plan_sections`, `ai_plan_tasks` 和 `ai_plan_items` 并在 Auth 设置中开启了 GitHub 提供商。)*

### 3. 运行本地服务

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)，你即可看到看板。

---

## ☁️ 一键部署到 Vercel (推荐)

想把这个专属的团队面板作为公网服务提供给合伙人？最简单的方法就是通过 Vercel：

1. 登录 [Vercel](https://vercel.com)
2. 选择 **Add New -> Project**
3. Import 你刚刚推送的这个 GitHub 仓库。
4. **最重要的一步**：在配置页面的 `Environment Variables` 中，务必填入上面的两条 `NEXT_PUBLIC_SUPABASE_***` 环境变量！
5. 狂点 Deploy！部署成功后，你会得到一个自带 HTTPS 的免备域名，发给同事即可直接使用。
