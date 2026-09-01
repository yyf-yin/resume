# 简历助手

基于目标岗位 JD 的 AI 简历优化 Agent Web App。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand
- lucide-react

## 快速开始

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 腾讯云部署

生产环境准备和部署步骤见 [DEPLOY_TENCENT.md](./DEPLOY_TENCENT.md)。

## 使用流程

1. 点击「使用示例数据」填充示例
2. 点击「开始分析」，JD 解析、简历诊断、匹配分析和经历追问会按完成顺序开放
3. 在「经历追问」中填写或使用语音输入回答，也可以明确跳过追问
4. 点击「根据追问生成优化结果」，生成优化对照、最终简历、评分和面试准备
5. 全部结果生成后，可在「导出结果」中复制最终简历

## 大模型接入

1. 复制环境变量模板：

```bash
cp .env.example .env.local
```

2. 填写 API Key 与模型配置（支持 OpenAI 兼容接口）：

```env
LLM_API_KEY=sk-your-deepseek-api-key-here
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
LLM_PROVIDER=deepseek
```

3. 重启开发服务器。顶部导航会显示 **AI 模式**；未配置 Key 时自动使用 **Mock 模式**。

## 腾讯云语音识别

经历追问支持腾讯云「一句话识别」。先在腾讯云开通语音识别服务，并为子账号授予一句话识别所需的最小权限，然后配置：

```env
TENCENT_CLOUD_SECRET_ID=your-secret-id
TENCENT_CLOUD_SECRET_KEY=your-secret-key
TENCENT_ASR_REGION=ap-shanghai
TENCENT_ASR_ENGINE_TYPE=16k_zh
```

密钥仅由服务端 API 读取。线上必须使用 HTTPS，浏览器才会开放麦克风权限。单次录音最长 55 秒，前端会生成 16kHz 单声道 WAV 后提交识别。

### 常用 Provider 示例

| Provider | LLM_BASE_URL | LLM_MODEL |
|----------|--------------|-----------|
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| DeepSeek | https://api.deepseek.com | deepseek-v4-flash |
| Moonshot | https://api.moonshot.cn/v1 | moonshot-v1-8k |

## 项目结构

```
src/
├── app/                 # Next.js App Router
├── components/
│   ├── layout/          # 布局组件
│   ├── steps/           # 流程步骤页面
│   ├── shared/          # 共享 UI 辅助
│   └── ui/              # shadcn/ui 组件
├── services/ai/         # AI 服务层
│   ├── resumeAgent.ts         # 客户端 API 调用
│   ├── resumeAgent.server.ts  # 服务端路由（Mock / LLM 切换）
│   ├── resumeAgent.llm.ts     # 真实大模型调用
│   └── resumeAgent.mock.ts    # Mock 数据
├── app/api/             # Next.js API Routes（保护 API Key）
│   ├── analyze/
│   ├── optimize/
│   └── follow-up/bullet/
├── store/               # Zustand 状态管理
└── types/               # TypeScript 类型定义
```
