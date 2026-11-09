# 阶段 11 实现计划：PWA 离线、备份与导出

只做可安装的应用外壳、离线查看本机行程、JSON 备份与导入、可打印攻略，以及不打断操作的版本提示。不改门禁（仍是 `AUTH_MODE=owner-key`），不改 DeepSeek 限额，不改高德核对规则，不修阶段 09 的两条遗留，不做阶段 12 的生产验收。Access 相关代码留着，不切换。

备份是这台设备上的 JSON 文件，不上传、不建账号、不做云端同步。

## 对照过的现状

- 路线图把阶段 11 写成「云端备份」。本阶段按任务改成本机 JSON 往返，不接新的云端存储。
- `vite.config.ts` 已用 `vite-plugin-pwa` 2：manifest 有名称、`standalone`、192/512 与 maskable，Workbox 对 `/api/` 与 `/_AMapService/` 使用 `NetworkOnly`，导航回退排除这两段。`registerType` 仍是 `autoUpdate`，并且 `skipWaiting: true`，新的服务工作线程会直接接管并刷新。这和「提示刷新、不强制打断」相反。
- `index.html` 已有 `apple-touch-icon`、`apple-mobile-web-app-capable`、`apple-mobile-web-app-title`、`apple-mobile-web-app-status-bar-style`、浅色与深色 `theme-color`。图标脚本 `scripts/generate-icons.mjs` 从 `favicon.svg` 出 180/192/512。`favicon.svg` 圆角外是透明像素；苹果会自己裁圆角，透明角会落在不可控的底色上。没有 `apple-touch-startup-image`。
- `src/main.tsx` 调用 `registerSW({ immediate: true })`，没有 `onNeedRefresh`。
- `wrangler.jsonc` 已是静态资源 SPA：`not_found_handling: single-page-application`，`run_worker_first: ["/api/*", "/_AMapService/*"]`。Worker 对 `/api` 与 `/_AMapService` 的 JSON 已带 `cache-control: no-store`。`/api/map/poi/search` 的边缘缓存是阶段 08 的行为，本阶段不改。
- Dexie `lvxu-travel` 到版本 7（`src/db/database.ts`）。表：`trips`、`days`、`places`、`lodgings`、`timelineItems`、`versions`、`aiUsage`、`mapRoutes`、`routePicks`、`ledgerEntries`、`bookings`、`checklistItems`、`favorites`、`travelNotes`。私人密钥在 `localStorage`（`lvxu-owner-key`），不在库里。
- 地图面板在展开时若 `navigator.onLine === false` 会显示「地图需要网络」。生成、助手、云端接口失败时多半只说「网络错误」或「接口暂时不可用」，没有说明本机行程仍可看。
- 动效：根上 `MotionConfig reducedMotion="user"`。位移约 0.2 秒，缓动 `[0.22, 1, 0.36, 1]`。`useQuietMotion()` 在减少动态效果或省流时不做过渡。
- 界面：暖纸色、朱砂、系统字体（含苹方）、8px 节奏、`max-w-lg`、底部三标签。空用 `Empty`，加载用 `Skeleton`，失败用 `Alert`。

## 官方文档里要守住的点

[Vite PWA：Prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update)：`registerType: "prompt"` 时新的服务工作线程停在 waiting。`onNeedRefresh` 里给出刷新和稍后。用户点刷新才调用 `updateSW()`，由它发送 `SKIP_WAITING` 再重新加载。不要 `skipWaiting: true`，否则会跳过这次确认。

[Workbox generateSW：排除路由](https://github.com/vite-pwa/vite-plugin-pwa/blob/main/docs/workbox/generate-sw.md)：`navigateFallbackDenylist` 用正则排除 `/api/` 与 `/_AMapService/`，避免离线导航被回退成 `index.html`。`generateSW` 的 `urlPattern` 只能是正则，不能是函数。`NetworkOnly` 不把响应写入 Cache Storage。默认只拦截 GET；对写方法也登记 `NetworkOnly`，避免以后改策略时把带鉴权的请求存下来。不使用 Background Sync。

[MDN：Service Worker 与 PWA 缓存](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)：缓存是显式的，不放进 Cache 就不会被服务工作线程拿来应答。鉴权、密钥和门禁数据只用网络。离线时导航可以回退到已预缓存的外壳；`/api/*` 失败就失败，不返回缓存的 JSON。

[Cloudflare：SPA 与 run_worker_first](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)：资源文件（含 `sw.js`、manifest、图标）走静态资源。`/api/*` 与 `/_AMapService/*` 先进入 Worker。不要把 `run_worker_first` 改成 `true`，否则每个静态文件都绕进脚本。现有数组保持不动。

[Apple：Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)：`apple-touch-icon` 按 `sizes` 选最接近的一张；180 是 iPhone 的尺寸，另备 167 与 152。`apple-mobile-web-app-capable` 让主屏幕以独立窗口打开。启动图用 `apple-touch-startup-image`，尺寸必须等于设备像素，并用 `media` 区分宽度、高度、像素比和方向。不提供时，系统可能用上次的截图或白屏。Safari 不根据 manifest 的 `background_color` 生成启动图。iOS 会自己裁图标圆角，图标应为不透明的正方形。

主题色继续用现有的两枚 `theme-color`（浅色 `#f6f3ec`，深色 `#1c1916`）。manifest 的 `id` 固定为 `/`，避免以后改 `start_url` 时被系统当成另一个应用。

## 服务工作线程

- `registerType` 改为 `prompt`。去掉 `skipWaiting` 与 `clientsClaim`。
- `injectRegister: false`。只在 `src/pwa/register.ts` 里注册一次，避免插件再注入一份。
- 预缓存仍是构建产物：`js/css/html/svg/png/ico/webmanifest`。启动图体积大，用 `globIgnores` 排除，不放进预缓存。
- 运行时对 `/api/` 与 `/_AMapService/` 的 GET/POST/PUT/PATCH/DELETE/HEAD 全部 `NetworkOnly`。
- 导航回退仍是 `/index.html`，排除上述两段。
- 页面重新可见时，以及大约每小时，调用 `registration.update()`。这只发现新版本，不刷新页面。
- 有等待中的新版本时，底部出现一条「有新版本」。稍后只藏起这条，不激活新线程。刷新才调用 `updateSW(true)`。
- 截图用 `?sw-update=1` 显示同一条提示。这不是第二套逻辑，只是在单次预览里看不到「再部署一版」时用来露出界面。

## 离线

外壳预缓存之后，离线重新打开仍进入应用。行程在 IndexedDB，不经过服务工作线程。

- `src/lib/online.ts`：`useSyncExternalStore` 听 `online` / `offline`。
- 外壳顶部一条状态：「当前离线。已保存在这台设备上的行程仍可查看。生成、助手、地图和云端接口需要网络。」恢复在线后收起。只做透明度，大约 0.2 秒；减少动态效果或省流时立刻出现。
- 生成：离线时不发请求。说明文字用「生成行程需要网络。已保存在这台设备上的行程仍可查看。」提交按钮不可用。
- 助手：离线时不发请求，不改日程。快捷指令不可用。
- 地图：离线时展开即停止在「地图需要网络」。核对与核实路线不可用。已经记在库里的「未核实 / 已核对」仍显示。选择已有路线方式只写本地，可以离线。
- 云端接口卡片：离线时不请求 `/api/status`，避免把断网说成「接口暂时不可用」。
- 私人密钥：离线时说明验证需要网络，密钥仍只在这台设备上。不改现有状态词（「网络错误」等），以免动到阶段 06 的断言。

## 备份

文件形状：

```json
{
  "format": "lvxu-backup",
  "schemaVersion": 7,
  "exportedAt": "2026-11-09T00:00:00.000Z",
  "app": "lvxu-travel",
  "tables": {}
}
```

`schemaVersion` 与当前 Dexie 版本对齐，表示表的形状，不是文件信封的版本。导出全部 14 张表。不读 `localStorage`，不写密钥、cookie 或授权头。

旧文件两种都认：

- 信封：`format: "lvxu-backup"`，表在 `tables` 里。
- 早期：表和 `schemaVersion` 放在顶层。没有版本号时按出现的表推断（有 `itinerary` 且没有 `days` 视为 1，有 `ledgerEntries` 视为 7，依此类推）。
- 大于 7 拒绝，避免悄悄丢掉以后新增的表。
- 版本 1：`trips[].name` 改成 `title`，`itinerary` 拆成日期、景点、住宿和时间线。拆分规则与 `src/db/migrate.ts` 相同（同一天一组，按 `order` 排）。同时有 `itinerary` 和 `days` 则拒绝。
- 缺的后续表视为空数组。地点和住宿缺 `mapSource` 时，现有 Zod 默认写成 `unverified`。
- 校验用现有的行程、账本 Zod。单条失败则整份拒绝，并指出哪一张表的第几条。重复 `id` 拒绝。
- 预览列出各表条数、从哪个版本迁过来、合并会新增或覆盖多少、替换会清掉多少。
- 合并：同一 `id` 比较 `updatedAt`，没有则 `fetchedAt`，再没有则 `createdAt`。备份上的时间不早于本机才覆盖。只在本机、不在备份里的记录保留。
- 替换：同一事务里先 `clear` 再 `bulkAdd`。
- 两种都要再确认一次。替换的确认写明会清掉这台设备上的行程、预算和清单。
- 事务中途抛错则整段回滚。失败文案是「写入没有完成，这台设备上的数据保持原样。」校验失败发生在事务之前。
- 超过 20MB 的文件不解析。

## 攻略

不用 jsPDF，也不在 Worker 上生成 PDF。中文字体要嵌入完整黑体，文件大，iPhone Safari 上内存和下载都差。浏览器打印使用系统字体栈里的苹方、冬青黑体、思源黑体和微软雅黑，Safari 的打印面板可以把结果存成 PDF，而且离线也能排。

页面在 `/trips/:tripId/guide`。屏幕上是预览，带「打印或存储为 PDF」和一句 iPhone 操作说明。打印时只留下攻略正文：日程、预算（沿用整数分与分币种合计）、预订、清单、收藏、备注。空的一节写明还没有内容。加载用骨架，找不到行程用空状态。

## 要新增的文件

- `src/pwa/register.ts`：注册、`onNeedRefresh`、稍后、定时检查更新。
- `src/lib/online.ts`
- `src/components/offline-banner.tsx`
- `src/components/update-prompt.tsx`
- `src/components/install-section.tsx`
- `src/components/backup-section.tsx`
- `src/components/backup-section.test.tsx`：非法文件不进入写入；预览能看见旧版本说明。
- `src/db/backup.ts`：导出、迁移、校验、预览、事务写入。
- `src/db/backup.test.ts`：往返一致；版本 1 与版本 4/6 迁到当前库；校验失败和事务中途失败都不改已有数据；导出不含私人密钥；导出的表集合等于 Dexie 的表。
- `src/pages/guide-page.tsx`
- `src/pages/guide-page.test.tsx`：京都示例能看到日程、预算、清单。
- `public/splash/apple-splash-*.png`：由图标脚本生成。iPhone 竖屏尺寸见下。浅色纸色与深色各一套。
- `public/apple-touch-icon-167.png`、`public/apple-touch-icon-152.png`。180 的 `apple-touch-icon.png` 改为不透明满幅。
- `e2e/stage11-offline.spec.ts`：安装元信息、离线外壳与行程、缓存里没有 `/api/` 和 `/_AMapService/`、备份预览与成功、攻略预览、更新提示。iPhone 390 与桌面。
- `docs/stage11/ACCEPTANCE.md`：测试跑完再写。
- `docs/stage11/screenshots/`：验收截图。

启动图（竖屏，像素等于点 × 倍率）：

| 设备 | 点 | 像素 |
| --- | --- | --- |
| iPhone SE | 375×667 @2 | 750×1334 |
| iPhone 12–14 | 390×844 @3 | 1170×2532 |
| iPhone 14/15 Pro、16 | 393×852 @3 | 1179×2556 |
| iPhone 16 Pro | 402×874 @3 | 1206×2622 |
| Plus | 428×926 @3 | 1284×2778 |
| Pro Max / 16 Plus | 430×932 @3 | 1290×2796 |
| iPhone 16 Pro Max | 440×956 @3 | 1320×2868 |

`media` 同时写上 `device-width`、`device-height`、`-webkit-device-pixel-ratio`、`orientation: portrait` 和 `prefers-color-scheme`。

## 要修改的文件

- `vite.config.ts`：prompt、manifest `id` 与图标 `purpose`、Workbox 排除与 `NetworkOnly`、不预缓存启动图。
- `index.html`：多尺寸 `apple-touch-icon`，启动图链接。
- `scripts/generate-icons.mjs`：不透明触摸图标与启动图。
- `src/main.tsx`：改走 `ensurePwa()`。
- `src/components/app-shell.tsx`：离线条与更新条。打印时高度不被 `h-dvh` 裁掉。
- `src/pages/profile-page.tsx`：安装说明与备份。
- `src/pages/plan-page.tsx`、`src/components/plan-screen.tsx`：离线不请求模型。失败时优先显示调用方给出的说明。
- `src/components/assistant-sheet.tsx`：离线不请求、不改行程。
- `src/components/map-panel.tsx`：离线时停在降级说明，并禁用核对与核实。
- `src/components/api-status-card.tsx`：离线文案，不发 `/api/status`。
- `src/components/owner-key-section.tsx`：离线说明。
- `src/components/trip-section-nav.tsx`：增加「攻略」。
- `src/router.tsx`：攻略路由。
- `src/index.css`：打印时隐藏 `.no-print`，正文用实色。
- `src/db/errors.ts`：`BackupError` 能进现有的用户可见错误句。
- `e2e/persistence.spec.ts`：`白川庵` 改用 `timeline-name`，避免和时间线旁边的「未核实」列表抢同一个文本。不改行程行为。
- `ROADMAP.md`、`README.md`：阶段 11 改成已完成的本机备份与离线外壳。

## 不改的文件

- `wrangler.jsonc` 的 `run_worker_first` 与 `AUTH_MODE`。
- `worker/map/http.ts` 里地点检索的边缘缓存。
- 阶段 09 助手的锁定按钮名称，以及对话只在面板打开时保留的行为。
- Dexie 版本号。本阶段不加表。
