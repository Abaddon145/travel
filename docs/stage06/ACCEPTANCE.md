# 阶段 06 验收

静态页面和 `/api/*` 由同一个 Worker 提供。付费和管理路径在调用任何上游之前先过门禁。当前门禁是私人密钥。Access JWT 的代码还在，等 Zero Trust 可以开通后再切换。本阶段没有接入生成或地图。

## 私人密钥

- `AUTH_MODE=owner-key`。也可取 `access` 或 `either`。未知值失败关闭。
- 明文只存在这台设备的 `localStorage`（`lvxu-owner-key`）。Worker secret `OWNER_KEY_SHA256` 是十六进制 SHA-256，不进仓库。
- `Authorization: Bearer <密钥>`，也接受 `X-Lvxu-Owner-Key`。只附在 `/api/paid`、`/api/admin`、`/api/auth`。
- 没有 secret，或 secret 不是 64 位十六进制：401 `unconfigured`。密钥缺失或错误：401。同一 IP 的失败次数达到限流绑定上限：429。
- Workers 限流周期只能是 10 或 60 秒，所以失败限流是每 60 秒 10 次，而不是 10 分钟 10 次。
- `GET /api/status` 返回 `authMode` 和 `configured`，不返回密钥或指纹。`GET /api/auth/check` 通过时返回 `{ "ok": true }`。
- 服务工作线程对 `/api/` 使用 `NetworkOnly`，导航回退也不拦截 `/api/`。
- `preview_urls` 为 `false`。`TEAM_DOMAIN` 与 `POLICY_AUD` 仍是明文变量。

## 以后改回 Access

1. 把 `wrangler.jsonc` 的 `AUTH_MODE` 改为 `access`（或 `either`，两种都接受）。
2. 在同一文件的 `vars` 里填上 `TEAM_DOMAIN`（`https://<team>.cloudflareaccess.com`）和 `POLICY_AUD`。不要把它们放进 secret。
3. `npx wrangler secret put ACCESS_ALLOWED_EMAIL`。
4. Zero Trust 只保护 `/api/paid` 和 `/api/admin`，不要挡住整个 `workers.dev` 主机。

## 新增与修改的文件

这一轮新增：

- `worker/owner-key.ts`、`worker/owner-key.test.ts`、`worker/gate.ts`
- `src/lib/owner-key.ts`、`src/lib/owner-key.test.ts`
- `src/components/owner-key-section.tsx`、`src/components/owner-key-section.test.tsx`
- `e2e/owner-key.spec.ts`

这一轮修改：

- `worker/api.ts`、`worker/api.test.ts`、`worker/index.ts`、`worker/redact.ts`、`worker/redact.test.ts`
- `wrangler.jsonc`、`.dev.vars.example`、`vite.config.ts`
- `src/lib/api-status.ts`、`src/lib/api-status.test.ts`、`src/components/api-status-card.tsx`
- `src/pages/profile-page.tsx`
- `README.md`、`ROADMAP.md`
- `docs/stage06/PLAN.md`、`docs/stage06/ACCEPTANCE.md`

未提交：`.dev.vars`、`worker/worker-configuration.d.ts`。没有写入 `OWNER_KEY_SHA256`。

## 测试结果

| 命令                                                  | 结果                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run lint`                                        | 通过                                                                   |
| `npm run typecheck`                                   | 通过。先生成 Worker 类型，再 `tsc -b`                                  |
| `npm run test`                                        | 17 个文件、47 个测试通过。含哈希比较、失败关闭、失败限流、日志脱敏     |
| `npm run build`                                       | 通过。生成的 `sw.js` 对 `/api/` 注册了 `NetworkOnly`                   |
| `npm exec playwright test e2e/owner-key.spec.ts`      | 1 个测试通过。覆盖未设置、验证中、已通过、密钥无效、尝试过多、网络错误 |
| `npm exec playwright test e2e/stage06-status.spec.ts` | 1 个测试通过                                                           |

## 验收清单

| 项                         | 结果                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| 未授权用户无法调用付费接口 | 通过。私人密钥未配置、缺失或错误时返回 401，付费处理函数不运行。Access 模式的 JWT 拒绝仍然在 |
| 生产 HTTPS 可访问          | 静态站已在 `https://lvxu-ai-travel.lvxu.workers.dev`。本轮部署由推送到 `main` 触发           |
| 静态资源与 API 同源        | 通过。`assets.run_worker_first` 为 `/api/*`                                                  |
| 本地绕过只在非生产生效     | 通过。`ENVIRONMENT=production` 时即使带上绕过标记也拒绝                                      |
| 限流                       | 通过。全局限流仍是每 60 秒 30 次。失败限流是每 60 秒 10 次，只计门禁失败，不计状态接口       |
| 日志脱敏                   | 通过。授权、cookie、邮箱、私人密钥字段和 Bearer 正文写成 `[redacted]`                        |
| 不破坏 01–05               | 通过。行程仍写在 IndexedDB。私人密钥不进 Dexie 行程库                                        |
| 不提前做 07                | 通过。没有调用 DeepSeek 或高德                                                               |

## 还要人做的事

1. 在另一台机器执行 `npx wrangler secret put OWNER_KEY_SHA256`，写入私人密钥的十六进制 SHA-256。不要提交明文，也不要提交这个指纹。
2. 密钥写入后，在「我的」里保存并验证。`GET /api/auth/check` 应返回 `{ "ok": true }`。
3. 账号可以开通 Zero Trust 之后，再按上面的步骤把 `AUTH_MODE` 改为 `access`。
