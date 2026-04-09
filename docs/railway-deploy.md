# Railway 部署说明

## 适用场景

这个项目当前适合按 `Next.js 全栈应用` 部署到 Railway。

原因：

- 项目不是纯静态站
- 仍然保留了 `/api/*` 路由
- 内置模型生成依赖服务端环境变量

## 项目已做的 Railway 适配

已经补好两项：

- `next.config.mjs` 开启 `output: "standalone"`
- `package.json` 的 `start` 改为启动 `.next/standalone/server.js`

所以 Railway 可以按标准 Node 服务启动。

## Railway 控制台操作

1. 打开 Railway，点击 `New Project`
2. 选择 `Deploy from GitHub repo`
3. 授权 GitHub（如果还没授权）
4. 选择仓库：
   - `daxianzhou000-cell/teacher-wish`
5. 进入服务后，确认：
   - Build Command：`npm run build`
   - Start Command：`npm run start`

如果 Railway 自动识别出了这两项，一般不用手改。

## 必填环境变量

在 Railway 服务的 `Variables` 中至少填写：

```env
MODEL_PROVIDER=custom

CUSTOM_API_KEY=你的内置key
CUSTOM_BASE_URL=https://api.gemai.cc/v1
CUSTOM_MODEL=gpt-5.4
```

如果还保留 OpenAI 备用，也可以补：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

## 上线后优先检查

1. 首页是否能正常打开
2. 模型设置页是否能打开
3. 用内置模型能否生成资料包
4. 学生档案、记录、反馈链路是否正常
5. Word 导出是否正常

## 注意

- Railway 是服务端部署，不是纯静态托管
- 浏览器本地存储仍然会按用户各自浏览器保存
- 但内置模型生成仍然依赖 Railway 上配置好的环境变量
