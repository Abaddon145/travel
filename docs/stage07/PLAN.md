# 阶段 07 实现计划：DeepSeek 行程草稿

只做「偏好 → 多日草稿 → 校验 → 预览 → 保存到现有行程库」。不接高德，不改地图，不开始 08 及以后。01–06 的 Dexie 行程、迁移和私人密钥门禁保持可用。

官方文档（2026-11 查阅）：

- [创建对话补全](https://api-docs.deepseek.com/api/create-chat-completion)：`POST https://api.deepseek.com/chat/completions`。本账户可用模型只有 `deepseek-flash` 与 `deepseek-v4-pro`。`response_format.type = json_object` 启用 JSON Output。`thinking.type = disabled` 关闭思考模式（省略时默认会思考）。`usage` 含 `prompt_tokens`、`completion_tokens`、`total_tokens`、`prompt_cache_hit_tokens`、`prompt_cache_miss_tokens`。
- [JSON Output](https://api-docs.deepseek.com/guides/json_mode)：提示词里必须出现 `json` 和示例。空白内容要当失败并重试。`max_tokens` 要设上限，避免截断和费用失控。
- [模型与价格](https://api-docs.deepseek.com/quick_start/pricing)：两款都支持 JSON Output。价格为每 100 万 token 的美元标价。`deepseek-flash` 闲时：缓存命中输入 $0.003、未命中 $0.15、输出 $0.6。`deepseek-v4-pro` 闲时：命中 $0.022、未命中 $0.66、输出 $1.98。高峰（工作日 01:00–04:00 与 06:00–10:00 UTC）为闲时的两倍。
- [错误码](https://api-docs.deepseek.com/quick_start/error_codes)：400 格式、401 鉴权、402 余额、422 参数、429 频率、500 服务器、503 过载。

账户余额大约 7 元，所以默认模型是便宜的 `deepseek-flash`，每日最多 30 次用户请求，并且单次输出限制在 8192 token。测试和 CI 不访问 DeepSeek。

## 边界

- 只有 Worker 调用 DeepSeek。密钥是已存在的 secret `DEEPSEEK_API_KEY`。本阶段不写入、不打印、不放进仓库。缺失时失败关闭，返回 `not_configured`。
- `DEEPSEEK_BASE_URL`（`https://api.deepseek.com`）和 `DEEPSEEK_MODEL`（`deepseek-flash`）是明文变量，部署不会把它们清掉。客户端可以改选 `deepseek-v4-pro`，其他模型名直接拒绝。
- `POST /api/ai/itinerary` 与原来的 `POST /api/paid/draft` 走同一条实现，都在现有私人密钥门禁后面。`GET /api/ai/usage` 同样要门禁。
- 日志沿用 `redact.ts`，并去掉 `sk-` 形式的密钥。不记录偏好原文。

## 请求与草稿

偏好用 Zod 限制体积：目的地与标题长度、日期跨度 1–14 天、人数 1–12、预算 `low|medium|high`、节奏 `relaxed|moderate|packed`、兴趣最多 8 条、备注最多 400 字、正文最大 8 KB。

模型必须返回 JSON。服务端再用 Zod 校验：每一天都落在日期范围内，景点/住宿字段能通过现有行程校验（名称 40 字、时间 `HH:MM` 或空）。无效 JSON 或不符合结构时，最多再修 2 次（把校验错误发回去）。429 和 5xx 按 400ms、800ms 退避，总尝试不超过 3 次，整次请求 25 秒超时。401/402 不重试。

成功响应包含草稿和用量：prompt/completion/total token、缓存命中与未命中、模型、耗时、尝试次数。

错误码：`not_configured`、`validation_error`、`invalid_output`、`rate_limited`、`quota_exceeded`、`timeout`、`network`、`upstream_auth`、`upstream_balance`、`upstream_unavailable`。DeepSeek 的 401 映射成 `upstream_auth`（502），避免和私人密钥的 401 混在一起。

## 额度

现有 `API_RATE_LIMIT` 仍限制短时频率。每日额度用一个 SQLite Durable Object `AiUsageLedger`（绑定 `AI_USAGE`，`migrations` 里 `new_sqlite_classes`）。部署时由 Wrangler 创建，不需要事先填 KV id。

- 通过校验后才占一个当日名额，按 Asia/Shanghai 的日期计算。
- 每天 30 次请求、100000 token。次数在调用前占用；若请求还没到达 DeepSeek 就失败，则退回次数。已经产生的 token 记入上限。
- 对象里只存日期、次数和 token，不存提示词或密钥。

## 客户端

- Dexie 版本 4 新增 `aiUsage` 表。不改 1–3 的行程表，旧数据留在原处。
- 生成成功后把用量写入本机，用来显示今日、本月的次数、token 和美元估算。估算按上面的闲时价格，并标明高峰约为两倍；不把人民币汇率写死。
- 行程列表进入「用 AI 起草」（`/plan`）。状态要齐全：空表单、生成中、重试中、预览成功、偏好校验错误、请求过频、额度用尽、网络错误、未授权、密钥未配置。
- 预览沿用现有时间线样式，标题可改。保存走仓库里的解析函数，一次写入行程、日期、景点和住宿，然后打开该行程。放弃或重新生成不覆盖已有行程。
- 「我的」里的云端接口卡：私人密钥验证通过后显示已验证，不再写「付费生成仍未接入」。
- 动效只做透明度与轻微位移，并尊重「减少动态效果」。不动画宽高。

## 文件

新增：

- `shared/ai-schema.ts`：偏好与草稿的 Zod。Worker 与页面共用。
- `worker/ai/deepseek.ts`、`generate.ts`、`quota.ts`、`usage-ledger.ts` 及对应测试。
- `src/lib/ai-client.ts`、`src/lib/ai-cost.ts`、`src/lib/ai-cost.test.ts`。
- `src/components/plan-screen.tsx`、`src/components/plan-screen.test.tsx`、`src/components/usage-stats.tsx`。
- `src/pages/plan-page.tsx`。
- `src/db` 中保存草稿与用量的函数，以及版本 4 迁移测试。
- `e2e/stage07-plan.spec.ts`。
- `docs/stage07/PLAN.md`、`ACCEPTANCE.md`、`screenshots/`。

修改：

- `wrangler.jsonc`、`.dev.vars.example`、`worker/index.ts`、`worker/api.ts`、`worker/redact.ts`。
- `vite.config.ts`、`tsconfig.app.json`、`worker/tsconfig.json`（让 `@shared` 指向共用 schema）。
- `src/router.tsx`、`src/pages/trips-page.tsx`、`src/pages/profile-page.tsx`。
- `src/components/api-status-card.tsx`、`src/components/owner-key-section.tsx`。
- `README.md`、`ROADMAP.md`。

## 测试与发布

`npm run lint`、`typecheck`、`test`、`build` 都必须通过。Playwright 在 390×844 下用假接口走完生成、预览、保存、刷新后仍在，并把各状态截到 `docs/stage07/screenshots/`。

提交到 `main` 后由现有工作流部署。部署后只对生产环境做不带密钥的 `GET /api/status` 和 `POST /api/ai/itinerary`，预期 401。不在 CI 或本环境调用 DeepSeek。
