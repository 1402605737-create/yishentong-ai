# 医审通 AI

中文医疗事前审核与补件助手，面向医保事前审核、商保预授权、互联网医院预审和医疗信息化场景。

[GitHub 仓库](https://github.com/1402605737-create/yishentong-ai) ·
[线上 Demo](https://yishentong-ai-web.vercel.app) ·
[后端健康检查](https://yishentong-ai-api.vercel.app/health) ·
演示视频待补充

这个项目不是医疗诊断系统，也不自动批准或拒绝医疗服务。它把中文病历摘要、检查申请、政策条款和材料清单转化为可审计的预审建议，并用 harness engineering 持续评测模型是否漏判缺件、乱引用政策或误判可提交。

## 项目能力

- 183 条合成脱敏案件，覆盖 6 个审核方向，每个方向至少 30 条。
- 展示案件从待预审到已处理的状态变化、Agent 执行步骤与完整 Trace。
- 结合中文政策检索、确定性规则、DeepSeek 生成和 Harness 安全闸门。
- 支持批量 Agent 审核、回归评测、Prompt 策略对比和模型调用审计。
- DeepSeek 调用记录明确展示成功、失败与本地 fallback。

## 技术栈

- 前端：Vue 3、Vite、TypeScript、TDesign Vue Next、Apache ECharts、Lucide Vue
- 后端：MidwayJS 4、Koa、TypeScript、Vercel Node Functions
- 线上数据库：Supabase Free Postgres，使用 Transaction Pooler
- 向量检索目标：Milvus，当前 MVP 内置中文政策检索降级实现
- 模型：DeepSeek V4 Flash，OpenAI-compatible API

## 部署架构

```text
Vercel Vue 前端
  -> Vercel Node API
     -> Supabase Postgres
     -> DeepSeek V4 Flash
```

后端在配置 `DATABASE_URL` 后自动创建 `yishentong_app_state` 和
`yishentong_model_call_log` 表，并幂等写入演示数据。没有配置数据库时，
仅在本地开发环境使用被 Git 忽略的 JSON 数据文件。

## 本地运行

```bash
npm install
npm run dev
```

前端默认地址：

```text
http://localhost:5178
```

后端默认地址：

```text
http://localhost:7101/api/health
```

## DeepSeek 配置

不配置 API Key 时，系统会自动使用本地规则推理，保证 demo 可离线运行。

```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<host>.pooler.supabase.com:6543/postgres?sslmode=require
FRONTEND_ORIGIN=http://localhost:5178,http://127.0.0.1:5178
```

## 验证命令

```bash
npm run build
npm test
npm --workspace apps/api run init:database
npm --workspace apps/api run verify:database
```

## 作品集讲法

> 我做的是一个中文医疗事前审核工作台。它用 DeepSeek V4 Flash 做低成本文档理解，用中文政策检索和规则引擎兜底确定性校验，并用 eval harness 持续测试模型在缺件识别、政策引用、误判放行上的表现。

## 安全边界

- 仅使用合成和脱敏示例数据。
- 不处理真实患者 PHI。
- AI 只给出提交前材料检查和补件建议。
- 所有“建议提交”结果都必须由人工复核确认。
