# 阶段 06 验收

静态页面和 `/api/*` 由同一个 Worker 提供。付费和管理路径在调用任何上游之前先校验 Access JWT。本阶段没有接入生成或地图。

## 新增与修改的文件

新增：

- `wrangler.jsonc`
- `worker/index.ts`、`api.ts`、`access.ts`、`rate-limit.ts`、`redact.ts`
- `worker/access.test.ts`、`api.test.ts`、`rate-limit.test.ts`、`redact.test.ts`、`tsconfig.json`
- `.dev.vars.example`
- `.github/workflows/deploy.yml`
- `src/lib/api-status.ts`、`src/lib/api-status.test.ts`
- `src/components/api-status-card.tsx`、`src/components/api-status-card.test.tsx`
- `e2e/stage06-status.spec.ts`
- `docs/stage06/PLAN.md`、`docs/stage06/ACCEPTANCE.md`

修改：

- `package.json`、`package-lock.json`：`wrangler`、`jose`，以及 `dev:api`、`deploy`、`cf-typegen`
- `vite.config.ts`：`/api` 代理到 `8787`，服务工作线程不拦截 `/api/`
- `src/pages/profile-page.tsx`、`src/test/setup.ts`、`tsconfig.json`、`eslint.config.js`、`.gitignore`
- `README.md`、`ROADMAP.md`

未提交：`.dev.vars`、`worker/worker-configuration.d.ts`（由 `wrangler types` 生成）。

## 测试结果

| 命令                                      | 结果                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run lint`                            | 通过                                                                                                        |
| `npm run typecheck`                       | 通过。先生成 Worker 类型，再 `tsc -b`                                                                       |
| `npm run test`                            | 14 个文件、34 个测试通过。包含 JWT 拒绝、生产环境关闭本地绕过、限流发生在付费处理之前、日志去掉授权头和邮箱 |
| `npm run build`                           | 通过                                                                                                        |
| `npm run test:e2e -- --grep 记录接口状态` | 1 个测试通过                                                                                                |
| `wrangler dev`                            | `GET /api/status` 为 200，`POST /api/paid/draft` 为 501（占位，未调用外部服务），首页为 200                 |

## 截图

视口 390×844。

- `/opt/cursor/artifacts/screenshots/api-unauthorized.png` 未授权
- `/opt/cursor/artifacts/screenshots/api-rate-limited.png` 请求过于频繁
- `/opt/cursor/artifacts/screenshots/api-settings.png` 「我的」里的已连接状态

没有生产 HTTPS 截图：当前环境没有 Wrangler 登录。

## 验收清单

| 项                         | 结果                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| 未授权用户无法调用付费接口 | 通过。没有有效 JWT，或邮箱不在允许名单时，`/api/paid/*` 与 `/api/admin/*` 返回 401，付费处理函数不会运行 |
| 生产 HTTPS 可访问          | 未在本环境完成部署。配置已指向 `workers.dev`。Wrangler 返回未登录，不能编造令牌                          |
| 静态资源与 API 同源        | 通过。`assets.run_worker_first` 为 `/api/*`，其余走静态资源，找不到页面时回 `index.html`                 |
| 本地 `wrangler dev`        | 通过。Vite 把 `/api` 代理到 `127.0.0.1:8787`                                                             |
| 本地绕过只在非生产生效     | 通过。`ENVIRONMENT=production` 时即使带上绕过标记也拒绝                                                  |
| 限流                       | 通过。绑定为每 60 秒 30 次，键是身份哈希或 IP。超限返回 429                                              |
| 日志脱敏                   | 通过。授权、cookie、邮箱、密钥字段写成 `[redacted]`                                                      |
| 不破坏 01–05               | 通过。原有单测仍在，行程仍写在 IndexedDB                                                                 |
| GitHub Actions             | 工作流只在 `Abaddon145/travel` 的 `main` 上部署。需要的密钥只写在文档里                                  |

## Access 策略

静态站保持公开，否则 PWA 无法打开。只给付费和管理路径加门：

1. Zero Trust → Access controls → Applications → 自托管应用。
2. 域名用部署后的 `*.workers.dev`，路径包含 `/api/paid` 和 `/api/admin`。
3. 策略为 Allow，Include 里只放 Wrangler secret `ACCESS_ALLOWED_EMAIL` 对应的那一个地址。
4. 把应用受众写进变量 `POLICY_AUD`，团队域名写进 `TEAM_DOMAIN`（`https://<team>.cloudflareaccess.com`）。
5. 不要对整个 `workers.dev` 主机启用 Access。

静态资源前面的内部路由不会把 `ctx.access` 传给用户 Worker，所以 Worker 自己用 `Cf-Access-Jwt-Assertion` 和 `jose` 校验。边缘策略还没配时，没有合法 JWT 的请求仍然进不了付费处理。

## GitHub 推送

未能从本环境推到 `https://github.com/Abaddon145/travel`。`gh auth status` 显示未登录任何 GitHub 主机，没有 SSH 密钥，`git ls-remote` 的结果是：`fatal: could not read Username for 'https://github.com': No such device or address`。没有使用 `--force`。Origin 草稿没有推送。

## 还要人做的事

1. 在该私有仓库的 Actions secrets 中添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。不要把令牌写进仓库。
2. 把本分支推到该仓库的 `main`（若已有 README 或许可证，用 merge 或 rebase，不要强推）。
3. `npx wrangler login` 后 `npm run deploy`，或等 GitHub Actions 部署。
4. 按上面的步骤创建 Access 应用，然后 `npx wrangler secret put ACCESS_ALLOWED_EMAIL`，并填上 `TEAM_DOMAIN` 与 `POLICY_AUD`。
