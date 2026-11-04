# 阶段 07 验收

可以按偏好生成多日草稿，校验后预览，并保存成现有行程。没有调用高德。测试和 CI 不访问 DeepSeek。

## 行为

- 默认模型 `deepseek-flash`，可选 `deepseek-v4-pro`。两者官方文档都支持 JSON Output。
- `POST /api/ai/itinerary` 与 `POST /api/paid/draft` 在私人密钥门禁之后才会生成。没有 `DEEPSEEK_API_KEY` 时返回 `not_configured`。
- 非法 JSON 或结构最多再修 2 次。429 与 5xx 退避。整次请求 25 秒超时。
- 每日额度：30 次请求、100000 token，记在 Durable Object `AiUsageLedger`。部署时的 migration 会创建它。
- 本机 Dexie 版本 4 增加 `aiUsage`，旧行程保留。费用按官方闲时美元标价估算，并注明高峰约为两倍。
- 「我的」里的云端接口在私人密钥验证通过后显示「已通过」。

## 测试

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run test` | 23 个文件、66 个测试通过 |
| `npm run build` | 通过 |
| `npx playwright test e2e/stage07-plan.spec.ts` | 通过。生成、预览、保存，刷新后行程仍在 |
| `npx playwright test e2e/stage06-status.spec.ts e2e/owner-key.spec.ts` | 通过 |

视口 390×844 的截图：

- `docs/stage07/screenshots/empty.png`
- `docs/stage07/screenshots/generating.png`
- `docs/stage07/screenshots/retrying.png`
- `docs/stage07/screenshots/preview.png`
- `docs/stage07/screenshots/validation-error.png`
- `docs/stage07/screenshots/rate-limited.png`
- `docs/stage07/screenshots/quota-exceeded.png`
- `docs/stage07/screenshots/network-error.png`
- `docs/stage07/screenshots/unauthorized.png`

## 还要人看的

密钥 `DEEPSEEK_API_KEY` 已经在 Worker 上，这次没有改它。部署成功后，带私人密钥调用 `POST /api/ai/itinerary` 才会真正生成。不带密钥应是 401。
