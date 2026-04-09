# Cloudflare 部署说明

## 当前结论

这个项目目前**不适合直接按 Cloudflare Next.js 官方最新 OpenNext 方案接入**，因为：

- 当前项目使用的是 `next@14.2.30`
- Cloudflare 当前推荐的 `@opennextjs/cloudflare` 新版本要求 Next 15/16

所以如果现在强行按最新 Workers + OpenNext 方案接，会遇到依赖不兼容。

## 这个项目当前的真实形态

这个项目不是纯静态站点，而是：

- 页面数据大量走浏览器本地存储
- 但仍然保留了 Next Route Handlers
- 内置模型生成也依赖服务端环境变量

所以如果未来要上 Cloudflare，目标应该是：

- **Cloudflare Workers**
- 不是纯静态 **Cloudflare Pages**

## 现在最稳的两条路

### 路线 A：先继续用当前部署平台

如果当前平台能跑 Next 服务端能力，这条路线最稳：

- 不改 Next 主版本
- 继续维护现有功能
- 等后面统一升级到 Next 15/16，再迁 Cloudflare

适合：

- 想先保证功能稳定
- 不想现在做框架升级

### 路线 B：准备迁 Cloudflare，但先升级 Next

如果你确定后续要上 Cloudflare Workers，推荐顺序是：

1. 升级项目到 Next 15/16
2. 跑完整回归测试
3. 再接 `@opennextjs/cloudflare`
4. 最后部署到 Cloudflare Workers

适合：

- 明确要长期用 Cloudflare
- 愿意接受一轮框架升级回归

## 将来迁到 Cloudflare 时需要的环境变量

至少需要这些：

```env
MODEL_PROVIDER=custom

CUSTOM_API_KEY=
CUSTOM_BASE_URL=https://api.gemai.cc/v1
CUSTOM_MODEL=gpt-5.4

OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

如果以后 Cloudflare 上启用内置模型，务必保证这些值配置在 Workers 环境变量里，而不是只放本地 `.env.local`。

## 现在不建议做的事

- 不要把这个项目当纯静态站点直接丢到 Pages
- 不要在 `next@14` 下强装最新 Cloudflare OpenNext 适配器
- 不要把真实内置 Key 提交进仓库代码

## 推荐的下一步

当前最现实的做法是：

1. 先继续用当前部署平台稳定功能
2. 如果后面确定迁 Cloudflare
3. 我再单独帮你做一轮 `Next 15/16 + Cloudflare Workers` 升级方案

到那一步时，我会一起处理：

- 依赖升级
- Cloudflare 配置文件
- 环境变量映射
- 生成链路回归测试
