# 阶段 06 实现计划：Cloudflare 部署与 API 安全

本阶段只做同一源站上的静态资源与 `/api/*`，以及门禁、限流和日志脱敏。不调用 DeepSeek，不接高德，不实现 07 及以后的功能。

当前账号还不能添加付款方式，因此 Zero Trust 先不启用。付费和管理接口现在用私人密钥。Access JWT 的校验留在代码里，以后把 `AUTH_MODE` 改成 `access` 即可切过去。

依据的文档：

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) 与 [run_worker_first](https://developers.cloudflare.com/workers/static-assets/binding/)
- [SPA 路由](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [校验 Access JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)（`Cf-Access-Jwt-Assertion` + `jose`）
- [Workers 上的 Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)：静态资源前面有一层内部路由，`ctx.access` 不会传到用户 Worker，所以付费接口必须自己验 JWT
- [Rate Limiting 绑定](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Wrangler secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## 现有代码怎么接

- 前端仍由 Vite 构建到 `dist/`。PWA 的 `navigateFallback` 必须排除 `/api/`，避免服务工作线程把接口请求换成 `index.html`。
- `src/pages/profile-page.tsx` 增加云端接口状态，不改行程的 IndexedDB 读写。
- 开发时 Vite（`43127`，HTTPS）把 `/api` 代理到 `wrangler dev`（`8787`），浏览器只看见同一个源。

## 路由

| 路径                    | 谁先处理                          | 鉴权                              | 作用                                                                         |
| ----------------------- | --------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| 页面与静态文件          | 静态资源；找不到则回 `index.html` | 不要求登录，生产 HTTPS 可直接打开 | 现有 PWA                                                                     |
| `GET /api/status`       | Worker                            | 不强制登录，但限流                | 报告 `authMode` 和门禁是否已配置。不返回密钥、指纹或邮箱                     |
| `GET /api/auth/check`   | Worker                            | 与付费接口相同的门禁              | 验证这台设备保存的私人密钥。通过时只返回 `{ "ok": true }`                    |
| `POST /api/paid/draft`  | Worker                            | 私人密钥，或以后的 Access JWT     | 以后才会调用付费上游的门。本阶段鉴权通过后只返回「尚未配置」，不发起外部请求 |
| `GET /api/admin/health` | Worker                            | 同上                              | 管理用健康检查，不返回密钥                                                   |

没有通过当前 `AUTH_MODE` 的调用，在进入付费处理函数之前就被拒绝。

## 鉴权

`wrangler.jsonc` 的明文变量 `AUTH_MODE` 取 `owner-key`、`access` 或 `either`。现在设为 `owner-key`。未知取值失败关闭。

### 私人密钥（现在）

- 明文密钥只留在浏览器本机（`localStorage` 键 `lvxu-owner-key`），不进仓库，不同步。
- Worker 的 secret `OWNER_KEY_SHA256` 是该密钥的十六进制 SHA-256。不要把明文放进 Worker。
- 请求用 `Authorization: Bearer <密钥>`，也接受 `X-Lvxu-Owner-Key`。只附在 `/api/paid`、`/api/admin` 和 `/api/auth` 上，不附在 `/api/status`。
- Worker 用 `crypto.subtle` 做 SHA-256，再用 `crypto.subtle.timingSafeEqual` 比较两个 32 字节摘要。密钥缺失或错误返回 401。secret 缺失或不是 64 位十六进制时失败关闭，返回 401 `unconfigured`。
- 失败按 IP 另计一次限流。Workers 的限流绑定周期只能是 10 或 60 秒，因此绑定是每 60 秒 10 次失败；这比「10 分钟 10 次」更紧。超限返回 429。状态接口不计失败次数。
- `preview_urls` 设为 `false`。

### Access（以后）

- 生产读取 `Cf-Access-Jwt-Assertion`，用 `TEAM_DOMAIN` 的 `/cdn-cgi/access/certs` 和 `POLICY_AUD` 校验签发者与受众，再比对 `ACCESS_ALLOWED_EMAIL`。比对失败或配置为空都拒绝。这段逻辑保持可测，`AUTH_MODE=access` 时启用。
- `either` 时，私人密钥或有效 JWT 任一通过即可。
- `ACCESS_ALLOWED_EMAIL` 是 Wrangler secret（本地写在不提交的 `.dev.vars`），不进前端包，不写进界面，不写进日志。
- `TEAM_DOMAIN` 和 `POLICY_AUD` 继续放在 `wrangler.jsonc` 的明文 `vars` 里。它们不是密钥。放在 vars 里，部署才会一直带上它们，而不会被清掉。
- 切换步骤：把 `AUTH_MODE` 改成 `access`，填上 `TEAM_DOMAIN` 与 `POLICY_AUD`，再 `npx wrangler secret put ACCESS_ALLOWED_EMAIL`。
- 本地绕过：仅当 `ENVIRONMENT` 不是 `production` 且 `.dev.vars` 里 `ACCESS_DEV_BYPASS=1`。`wrangler.jsonc` 把生产设为 `production`，因此部署后绕过关闭。`.dev.vars` 不提交；只提交 `.dev.vars.example` 占位。`OWNER_KEY_SHA256` 在示例里也只是空占位。

## 限流与日志

- 绑定 `API_RATE_LIMIT`：每身份或每 IP，60 秒 30 次。已验证邮箱用其哈希做键，否则用 `CF-Connecting-IP`。
- 日志只打路径、状态和结果类别。写出前删掉 `authorization`、`cookie`、邮箱、令牌、`ownerKey`、`x-lvxu-owner-key` 和 Bearer 正文。绝不记录私人密钥。

## Access 怎么挂上

静态站保持公开，只保护付费和管理路径，否则 PWA 打不开。

1. Zero Trust → Access controls → Applications → 自托管应用。
2. 域名为部署后的 `*.workers.dev`，路径包含 `/api/paid` 与 `/api/admin`。
3. 策略为 Allow，Include 里只放 `ACCESS_ALLOWED_EMAIL` 那一个地址（一次性邮箱登录）。
4. 把应用的 AUD 填进 Worker 变量 `POLICY_AUD`，团队域名填进 `TEAM_DOMAIN`（形如 `https://<team>.cloudflareaccess.com`）。
5. 不要对整个 `workers.dev` 主机一刀切启用 Access，否则首页也会被拦住。

现在的门闩是私人密钥。Access 配好并把 `AUTH_MODE` 改为 `access` 之后，Worker 内的 JWT 校验才是付费接口的门闩。边缘 Access 未配好时，没有合法 JWT 的调用仍然进不去。

## 要新增的文件

- `wrangler.jsonc`：名称、兼容日期、静态资源、`run_worker_first: ["/api/*"]`、限流、可观测性、非密钥变量。
- `worker/index.ts`：入口。`/api/*` 交给处理函数，其余交给 `env.ASSETS`。
- `worker/api.ts`：状态、付费占位、管理健康检查。
- `worker/access.ts`：JWT 校验与允许名单。可注入验证函数，便于单测。
- `worker/owner-key.ts`：私人密钥的哈希与常量时间比较。
- `worker/gate.ts`：按 `AUTH_MODE` 选择私人密钥、Access 或两者。
- `worker/rate-limit.ts`：调用限流绑定。
- `worker/redact.ts`：日志脱敏。
- `worker/access.test.ts`、`worker/rate-limit.test.ts`、`worker/redact.test.ts`、`worker/api.test.ts`。
- `worker/tsconfig.json`，并挂进根 `tsconfig.json`。
- `worker/worker-configuration.d.ts`：由 `wrangler types` 生成。
- `.dev.vars.example`：只有占位，没有真实密钥。
- `.github/workflows/deploy.yml`：`npm ci`、lint、typecheck、test、build，再用 `cloudflare/wrangler-action` 部署。
- `src/lib/api-status.ts`、`src/components/api-status-card.tsx` 及组件测试。
- `e2e/stage06-status.spec.ts`：390×844 截未授权、限流和设置状态。
- `src/components/owner-key-section.tsx`、`src/lib/owner-key.ts`：本机保存与验证。
- `e2e/owner-key.spec.ts`：设置页的未设置、验证中、已通过、无效、过多和网络错误。
- `docs/stage06/ACCEPTANCE.md`：实现并验证之后再写。

## 要修改的文件

- `package.json`：`wrangler`、`jose`；脚本 `dev:api`、`deploy`、`cf-typegen`。
- `vite.config.ts`：把 `/api` 代理到 `8787`；PWA 排除 `/api/`。
- `.gitignore`：`.dev.vars`、`.wrangler`。
- `src/pages/profile-page.tsx`：挂上接口状态卡和「私人密钥」。
- `README.md`、`ROADMAP.md`：本地 `wrangler dev`、GitHub 密钥 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`、06 标成已完成。

## 部署

优先 `wrangler deploy` 到 `workers.dev` HTTPS。没有令牌或账号时不编造凭据，在验收里写下还要人完成的步骤。不自行发布 Origin 仓库。
