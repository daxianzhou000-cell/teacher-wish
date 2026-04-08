# 补课备课包生成器

一个面向补课老师的本地工具，用来生成补课讲义、管理学生、保存补课记录，并支持把历史记录复用为下一次备课。

## 当前版本功能

- 生成补课备课包
- `mock / openai / custom` provider 切换
- 学生新增、编辑、删除
- 补课记录新增、编辑、删除
- 学生列表搜索与筛选
- 学生历史记录搜索、筛选、排序
- 从历史记录复制为新备课
- 按模块导出 Word

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

复制一份环境变量模板：

```bash
cp .env.example .env.local
```

默认可直接使用 `mock`：

```env
MODEL_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
CUSTOM_API_KEY=
CUSTOM_MODEL=
CUSTOM_BASE_URL=
```

如果要测试真实 OpenAI provider：

```env
MODEL_PROVIDER=openai
OPENAI_API_KEY=你的_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

如果你使用中转、代理或其他兼容 OpenAI 的平台：

```env
MODEL_PROVIDER=custom
CUSTOM_API_KEY=你的_key
CUSTOM_MODEL=平台提供的模型名
CUSTOM_BASE_URL=https://你的平台地址/v1
```

说明：

- 每个模型槽位都可以选择使用“内置 Key”或“自定义 Key”
- `API Key` 不会保存到 `data/model-settings.json`
- 模型设置页里填写的自定义 key 只用于当前运行会话，不会写入本地文件
- 正式生成时会优先读取 `.env.local` 里的 `OPENAI_API_KEY` 或 `CUSTOM_API_KEY`
- 如果你已经在页面里保存了模型名称和 Base URL，只需要补上对应环境变量就能继续使用

3. 启动开发环境

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

如果你想用“干净模式”启动开发环境：

```bash
npm run dev:reset
```

## 数据存储

当前版本继续使用本地 JSON 持久化：

- 数据文件：[data/app-data.json](/Users/zhoudaxian/Desktop/助教/data/app-data.json)
- 模型设置文件：[data/model-settings.json](/Users/zhoudaxian/Desktop/助教/data/model-settings.json)

适合本地试用、单人维护，不依赖外部数据库。

其中模型设置文件只保存：

- provider
- model
- baseUrl
- enabled

不会保存真实 `API Key`。

## 推荐试用流程

1. 在首页先新增一个学生
2. 填写补课主题并生成备课包
3. 选择掌握程度、填写老师反馈并保存补课记录
4. 进入学生详情页查看历史记录
5. 测试搜索 / 筛选 / 排序
6. 点击“复制为新备课”，回到首页继续生成下一次讲义
7. 测试老师版 / 学生版 Word 导出

## Word 导出说明

支持模块：

- 课堂目标
- 重难点
- 知识点总结
- 课堂练习
- 课后作业
- 答案解析
- 家长反馈

导出预设：

- 老师版：默认包含全部核心模块
- 学生版：默认包含知识点总结、课堂练习、课后作业
- 自定义：手动勾选后导出

## 开发态注意事项

如果浏览器里出现类似下面的 Next.js 开发态报错：

- `Cannot find module './276.js'`
- `vendor-chunks/@swc.js`
- 页面突然 500

当前项目已经把开发目录和生产构建目录分开：

- 开发环境：`.next-dev`
- 生产构建：`.next`

这样可以明显降低 `next dev` 和 `next build` 互相污染缓存的概率。

## 推荐开发流程

日常本地试用：

```bash
npm run dev
```

如果怀疑开发缓存脏了：

```bash
npm run dev:reset
```

如果要做正式构建验证：

```bash
npm run verify
```

这里的 `typecheck` 已经单独使用了稳定的 `tsconfig.typecheck.json`，
不会再被 Next 在构建时自动改写的 `.next/types` 配置影响。

如果只想清掉缓存：

```bash
npm run clean:dev
npm run clean:build
```

或者一次清掉全部：

```bash
npm run clean
```

建议：

- 平时调页面时用 `npm run dev`
- 需要提交前再跑 `npm run verify`
- 不要在同一个旧的报错页面上反复点返回，先刷新一次页面

如果仍然出现缓存类问题，可以按下面顺序处理：

1. 先停止当前 `npm run dev`
2. 删除开发缓存目录

```bash
rm -rf .next-dev
```

3. 再重新启动

```bash
npm run dev
```

## 当前版本定位

这是一个 v1 可试用版，重点是让老师能够完成：

- 生成讲义型备课包
- 管理学生
- 保存和维护补课记录
- 从历史记录快速复用下一次备课
- 导出老师版 / 学生版 Word
