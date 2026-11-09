# 旅序发布说明

版本 1.0.0。单人、私有仓库、同一 HTTPS 源站。不提交应用商店或公开目录。

## 架构

浏览器里是 React + TypeScript + Vite。行程、预算、预订、清单和版本历史写在这台设备的 IndexedDB（Dexie）。Zustand 只记外观偏好。TanStack Query 管云端状态。

Cloudflare Worker `lvxu-ai-travel` 用静态资源绑定提供外壳，并用 `run_worker_first` 只接住 `/api/*` 与 `/_AMapService/*`。DeepSeek 和高德的密钥只在 Worker 上。浏览器拿到的高德 JS key 来自已通过门禁的 `/api/map/config`，安全密钥不进前端。

服务工作线程预缓存外壳。`/api/` 与 `/_AMapService/` 是 `NetworkOnly`，不缓存鉴权响应。有新版本时提示刷新，不强制打断。

生产地址：`https://lvxu-ai-travel.lvxu.workers.dev`。

## 环境变量

只列名称。值放在 Wrangler secret、GitHub Actions secret 或本机 `.dev.vars`（已忽略）。不要写进仓库、日志或截图。

明文变量（`wrangler.jsonc` 的 `vars`，生产里可以是空字符串）：

| 名称 | 作用 |
| --- | --- |
| `ENVIRONMENT` | `production` 时关闭本地绕过 |
| `ACCESS_DEV_BYPASS` | 仅非生产，且值为 `1` 才绕过 |
| `AUTH_MODE` | 当前是 `owner-key`。`access` 与 `either` 的代码留着 |
| `TEAM_DOMAIN` | Access 团队域，启用 Access 时才填 |
| `POLICY_AUD` | Access 受众，启用 Access 时才填 |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 默认 `deepseek-flash` |
| `AI_DAILY_REQUEST_CAP` | 每日次数，默认 30。不要改限额 |
| `AI_DAILY_TOKEN_CAP` | 每日令牌，默认 100000。不要改限额 |

Secret：

| 名称 | 作用 |
| --- | --- |
| `OWNER_KEY_SHA256` | 私人密钥的十六进制 SHA-256，不是明文 |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `AMAP_JS_KEY` | 高德 JS API，经接口下发给已授权的浏览器 |
| `AMAP_JS_SECURITY_CODE` | 高德安全密钥，只留在 Worker |
| `AMAP_WEB_KEY` | 高德 Web 服务 |
| `ACCESS_ALLOWED_EMAIL` | Access 允许的邮箱。当前门禁不使用它 |

GitHub Actions：

| 名称 | 作用 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 部署 Worker |
| `CLOUDFLARE_ACCOUNT_ID` | 目标账号 |

绑定（不是密钥）：`ASSETS`、`API_RATE_LIMIT`、`AUTH_FAILURE_LIMIT`、`AI_USAGE`。

## 部署

1. 在功能分支上通过 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e`。
2. 合并到 `main`。`.github/workflows/deploy.yml` 会再跑 lint、typecheck、test、build 和 `node scripts/scan-secrets.mjs --dist`，然后 `wrangler deploy`。
3. 部署后工作流执行 `node scripts/smoke-production.mjs`：检查 HTTPS、安全头、manifest、服务工作线程、连续请求，以及不带密钥时付费路径返回 401。冒烟不打印响应正文。

不要在笔记本上对生产执行 `npm run deploy`，除非工作流不可用且你明确知道自己在发版。

回滚：

1. 在 Cloudflare 控制台打开 Worker `lvxu-ai-travel` 的版本列表，把上一版重新部署。静态资源和脚本一起回去。
2. 或把 `main` 回退到上一个好的提交再推送，让工作流再部署一次。回退前确认没有人依赖中间那一版的本地数据结构。本版没有升 Dexie 版本。
3. 回滚不会删除设备上的 IndexedDB。备份文件仍然可以导入。

## 备份与恢复

在「我的」导出 JSON（`format: lvxu-backup`，`schemaVersion: 7`）。文件含 14 张表，不含私人密钥。导入前有预览。合并按较新的时间；替换在一个事务里清空再写入，失败则保持原样。用系统的文件 App 或隔空投送保管这份文件。应用不上传备份。

## 额度

DeepSeek 每天最多 30 次请求、10 万令牌，记在 Worker 的 Durable Object 上。高德和生成都先过私人密钥，并有按来源的速率限制。测试不得调用这两个上游。

## 已知限制

- 真机冷启动、打印面板和主屏幕安装要按 `docs/stage12/DEVICE_CHECKLIST.md` 人工确认。Playwright 的断网不会让一次新的文档导航走服务工作线程。
- 助手对话只留在当前页面的内存里。关闭面板再打开还在；刷新或离开行程就没了。已经应用的修改在版本记录里，可以恢复。这是阶段 09 留下的行为，本版不改存储。
- 内容安全策略允许 `https://webapi.amap.com` 和 `'unsafe-eval'`，因为高德 JS API 2.0 会动态加载并使用 eval。没有放开任意脚本源。未使用 `Cross-Origin-Embedder-Policy: require-corp`，否则瓦片会被挡住。
- `GET /api/status` 不要求密钥，只返回门禁模式、是否已配置和 `paidApi: "locked"`。它不调用 DeepSeek 或高德，也不返回密钥、指纹或邮箱。
- 地点检索仍使用 Worker 边缘缓存。浏览器服务工作线程不存这些响应。
- 单人、单设备数据。没有账号，也没有云端同步。
- 仓库保持私有。`X-Robots-Tag: noindex` 只是减少 workers.dev 被索引，不是访问控制。
