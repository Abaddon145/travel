# 阶段 12 安全审计

没有在本文、日志或截图里写下任何密钥值。扫描脚本也只输出类型、路径和提交。

## 依赖

`npm audit`：19 项，0 危急、0 高、16 中、3 低。中低项集中在 eslint、glob、minimatch、typescript-eslint、shadcn、vite-plugin-pwa 和 workbox-build，都是开发或构建依赖。没有执行 `npm audit fix --force`，以免为了清零改掉锁定的主版本。

## 密钥

`node scripts/scan-secrets.mjs` 扫工作区和全部 git 历史。规则包括私钥块、`AKIA`、`sk-` 形态、Google API key 形态，以及赋给 `DEEPSEEK_API_KEY`、`AMAP_JS_KEY`、`AMAP_JS_SECURITY_CODE`、`AMAP_WEB_KEY`、`OWNER_KEY_SHA256`、`CLOUDFLARE_API_TOKEN`、`ACCESS_ALLOWED_EMAIL` 的长字面量。测试夹具里的占位字符串被跳过。结果：无发现。

`node scripts/scan-secrets.mjs --dist` 再扫构建产物，无发现。高德 JS key 只出现在已通过门禁的 `/api/map/config` 响应里，不进静态文件。安全密钥、DeepSeek 密钥和主人密钥指纹不进前端包。

部署工作流在 `wrangler deploy` 之前跑同一扫描。

## 门禁

`AUTH_MODE` 仍是 `owner-key`。Access 的 JWT 代码留着，没有切换。

配置了 `OWNER_KEY_SHA256` 时，无密钥访问这些路径返回 401，并且不会调用生成或地图处理：`/api/ai/itinerary`、`/api/ai/revise`、`/api/ai/usage`、`/api/map/config`、`/api/auth/check`、`/api/paid/draft`、`/api/admin/health`。`/_AMapService/*` 没有地图 cookie 时返回 401。cookie 只在已通过的 `/api/auth/check` 或 `/api/map/config` 上签发。

`GET /api/status` 仍然公开。正文只有服务名、环境、门禁模式、是否已配置、`auth` 和 `paidApi: "locked"`。单元测试确认它不含指纹、邮箱或请求里的密钥。付费路径另有按来源的速率限制，失败的密钥尝试另有计数。每日 DeepSeek 限额仍是 30 次、10 万令牌，没有改。

## 响应头

静态资源走 `public/_headers`（构建时再写入 `dist/_headers`）。`/api` 与 `/_AMapService` 由 Worker 套上同一组头，不改已有的 `cache-control`。

- `Content-Security-Policy`：默认 `'self'`。`script-src` 为 `'self' https://webapi.amap.com https://*.amap.com 'unsafe-eval'`，不含 `'unsafe-inline'`。高德 JS API 2.0 除 `webapi.amap.com` 外还会插入 `https://mapplugin.amap.com`、`https://vdata.amap.com` 等二级脚本，并使用 eval；只放行主脚本时这些脚本会被 `script-src-elem` 拦住，底图变成空白。`font-src` 为 `'self' data: https://*.amap.com`。`img-src` 与 `connect-src` 在原有高德域名之外增加 `https://*.autonavi.com`，`connect-src` 另允许 `blob:`。样式仍允许内联，因为高德和 Motion 会写样式。`frame-ancestors 'none'`；`object-src 'none'`。不用 `Cross-Origin-Embedder-Policy: require-corp`。
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`：摄像头、麦克风、地理定位、支付和 USB 关闭
- `Strict-Transport-Security: max-age=15552000; includeSubDomains`（无 `preload`）
- `X-XSS-Protection: 0`
- `X-Robots-Tag: noindex`

本地预览使用同一组头，端到端因此是在带内容安全策略的构建上跑的。

服务工作线程对 `/api/` 与 `/_AMapService/` 的各方法使用 `NetworkOnly`，不把鉴权响应写入 Cache Storage。

## 当前生产（只读，不带密钥）

检查时间在本分支合并之前，所以还没有上面的安全头。`https://lvxu-ai-travel.lvxu.workers.dev`：

| 请求 | 状态 |
| --- | --- |
| 连续 5 次 `GET /` | 都是 200，URL 为 https |
| `GET /sw.js` | 200。正文含 `NetworkOnly`、`api`、`_AMapService`，不含 `CacheFirst` |
| `GET /manifest.webmanifest` | 200 |
| `GET /api/status` | 200。正文不匹配私钥、`sk-`、`AKIA` 或 `AIza` 形态 |
| `POST /api/ai/itinerary`、`GET /api/map/config`、`GET /_AMapService/` | 401 |

当时响应里还没有 CSP、HSTS、`nosniff`、`Referrer-Policy`、`Permissions-Policy` 或 `X-Robots-Tag`。合并后工作流会部署，并运行 `node scripts/smoke-production.mjs`。冒烟只打印状态码和头名称，不打印正文，也不使用密钥。
