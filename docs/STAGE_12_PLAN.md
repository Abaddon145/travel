# 阶段 12 实现计划：质量验收与正式发布

只做质量、无障碍、安全和发布准备。不加新功能，不改 DeepSeek 每日限额（仍是 30 次、10 万令牌），不切换门禁（仍是 `AUTH_MODE=owner-key`，Access 代码留着），不推 `main`，不合并，不执行 `wrangler deploy`。生产部署由用户验收后合并 PR，由已有 GitHub Actions 完成。仓库保持私有，不提交商店或目录。

付费接口在测试里一律 mock。不请求 `api.deepseek.com`、`webapi.amap.com`、`restapi.amap.com`。

## 对照过的现状

- 单元与集成：39 个测试文件（阶段 11 验收时 119 个测试）。覆盖仓库、校验、备份往返、预算合计、助手补丁剔除锁定、高德解析、额度、门禁、限流和脱敏。没有一条把「新建并编辑行程、AI 起草、锁定后局部重排与撤销、地图限界、预算、预订与清单持久化、备份、离线外壳、更新提示」串成同一份端到端，也没有 WebKit。
- Playwright：`playwright.config.ts` 只有一套默认配置，视口 390×844，没有 `projects`，也没有 WebKit。`e2e/` 已有持久化、门禁、阶段 06–11。截图写进各阶段目录，测试里自己 `setViewportSize`。
- 动效：根上 `MotionConfig reducedMotion="user"`。页面、地图、助手、离线条和更新条只用 `opacity` / `transform`。`useQuietMotion()` 在减少动态效果或省流时跳过过渡。例外是 `src/components/money-figure.tsx`：数字用 `animate()` 改 `textContent`，不是 transform/opacity。抽屉和对话框用 `tw-animate-css` 的 fade/zoom（opacity 与 transform）。按钮 `active` 是 `translate-y-px`。
- 无障碍：时间线锁定按钮在 `timeline-editor.tsx` 已有中文 `aria-label`（`锁定/解锁` + 名称）。阶段 09/10/11 仍把「锁定按钮无障碍名称为空」记为遗留，需要用 axe 在真实 DOM 上确认是 lucide 图标盖住了名称，还是触控目标（`size="icon"` 为 32px）一类的严重问题。图标按钮、默认按钮（`h-8`）和部分输入框（助手说明、时间输入是 `text-sm`）小于 44px。iOS 在输入框字号小于 16px 时会放大页面。自定义时间输入和助手输入没有 shadcn 的 `focus-visible` 环。
- 主题：`lvxu-preferences` 里 `system | light | dark`，`ThemeSync` 切换 `html.dark`。浅色纸色与深色变量在 `src/index.css`。没有 axe。
- 助手对话：`AssistantSheet` 的 `history` 是组件状态。同一页关闭再打开还在；刷新或离开行程就没了。已应用的修改在版本记录里。阶段 09 明确不在刷新后保留对话，阶段 10/11 不修。这不是验收范围内的小修补：要跨刷新留住对话就得新的存储。本阶段不改，记入遗留。
- 安全头：`/api` 与 `/_AMapService` 有 `cache-control: no-store`（地点检索的边缘缓存是阶段 08 的行为，不改策略）。没有 CSP、HSTS、`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`、`X-Frame-Options`。静态资源由 Assets 直接返回，`run_worker_first` 只包含 `/api/*` 与 `/_AMapService/*`。
- 门禁：`AUTH_MODE=owner-key` 时，付费、管理、认证、AI、地图路径没有密钥返回 401。`/_AMapService/*` 要地图 cookie，cookie 只在已通过的 `/api/auth/check` 或 `/api/map/config` 上签发。`GET /api/status` 故意公开，只返回模式、是否已配置和 `paidApi: "locked"`，不返回密钥、指纹或邮箱；前端用它区分「尚未配置」和「未授权」。未知 `/api/*` 在未授权时返回 404。本阶段不把公开状态接口改成 401，以免「我的」里失去「尚未配置门禁」。
- 部署：`.github/workflows/deploy.yml` 已在部署前跑 lint、typecheck、test、build，然后 `wrangler-action` deploy。没有部署后冒烟，也没有密钥扫描。
- 文档：没有 `CHANGELOG.md`、`docs/RELEASE.md`。README 停在阶段 11 的运行说明。

## 官方文档里要守住的点

[Playwright：Emulation](https://playwright.dev/docs/emulation)：`devices['iPhone 14']` 带 WebKit 的 `defaultBrowserType`、390×844、`deviceScaleFactor: 3`、`isMobile`、`hasTouch`。桌面用 `devices['Desktop Chrome']` 再把视口写成 1280×800。`colorScheme` 与 `reducedMotion` 用 `emulateMedia`。`display-mode` 不在 `emulateMedia` 里，不能假装浏览器已经是主屏幕。

[axe-core Playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)：`new AxeBuilder({ page }).analyze()`。严重（serious）和危急（critical）算失败，包含 `button-name` 与 `color-contrast`。修完再跑。不把整份节点 HTML 写进会进仓库的日志，以免夹进页面上的密钥字段；测试数据里不放真实密钥。

[Workers 静态资源响应头](https://developers.cloudflare.com/workers/static-assets/headers/)：`public/_headers` 会进构建产物，只作用在 Assets 的响应上，不作用在 Worker 生成的 `/api` 与 `/_AMapService` 上。规则最多 100 条，每行 2000 字符。不要把 `run_worker_first` 改成 `true`。

[Workers 安全头示例](https://developers.cloudflare.com/workers/examples/security-headers/)：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy`、`Permissions-Policy`、CSP、HSTS。示例里的 `Cross-Origin-Embedder-Policy: require-corp` 会挡住高德瓦片，不用。HSTS 不写 `preload`，避免被送进预加载列表。`X-XSS-Protection` 置 `0`（旧过滤器会引入漏洞）。

[Apple：Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)：主屏幕沿用阶段 11 的 `apple-mobile-web-app-capable`、不透明图标和启动图。`viewport-fit=cover` 已经有了，安全区用 `env(safe-area-inset-*)`。

[MDN：display-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode)：`standalone` 时禁止文档级回弹，高度继续用 `100dvh`，让外壳自己滚动。脚本里用 `matchMedia('(display-mode: standalone)')` 同步到 `html[data-display]`，测试才能在不能模拟该媒体特性的 Playwright 里看到同一条分支。真机仍走 CSS 媒体查询，不依赖脚本先跑完。

[vite-plugin-pwa](https://vite-pwa-org.netlify.app/guide/)：保持 `registerType: "prompt"`，不打开 `skipWaiting`。`/api/` 与 `/_AMapService/` 继续 `NetworkOnly`，导航回退继续排除这两段。鉴权响应不进 Cache Storage。

输入框字号：WebKit 在聚焦时若计算字号小于 16px 会缩放页面。iPhone 宽度上输入、选择和时间字段保持 `text-base`（16px）。`md:text-sm` 只在更宽的视口上生效。

触控目标按本阶段验收要求取 44px（WCAG 2.5.5 的尺寸），不满足的是按钮和图标按钮，不是正文。

## 测试怎么摆

`playwright.config.ts` 拆两个 project，共用一次 HTTPS 预览：

- `iphone`：`...devices["iPhone 14"]`，只跑 `e2e/stage12-*.spec.ts`，避免旧用例把 `docs/stage11/screenshots` 再用 WebKit 盖掉。
- `desktop`：Chromium，1280×800，跑全部 `e2e/`。旧用例自己会改视口。

DeepSeek 与高德在用例里 `page.route` mock，并 `abort` 三个上游源站。

`e2e/stage12-flows.spec.ts`（两个 project 都跑）串这些路径，种子行程仍用现有京都数据：

- 新建行程、改标题、加一天、加景点，刷新后还在；锁定后编辑、移动、删除不可用。
- mock `POST /api/ai/itinerary`，预览后保存；不出现上游地址。
- 打开助手，mock `POST /api/ai/revise`：锁定项被拒绝，未锁定项可应用，撤销后回到原文。
- 展开地图，mock 配置、检索和路线。断言画面不请求高德源站。限界本身由现有 `route-line.test.tsx` 检查 `setFitView` 的 `routeFitPadding`，并补一条越界坐标被丢掉的断言（若还没有）。
- 预算页合计仍是京都示例的 `¥4,565.00`，且按币种分开。
- 预订和清单各加一条，刷新后还在。
- 导出备份，确认 JSON 不含 `lvxu-owner-key`；导入预览后合并。
- 已打开的页面断网后仍能看到行程；生成按钮不可用。`context.setOffline` 不能用来测冷启动导航（阶段 11 已记录），冷启动写进真机清单。
- `?sw-update=1` 出现「有新版本」，稍后只隐藏，不要求第二次部署。

`e2e/stage12-iphone.spec.ts`（WebKit）：

- 外壳计算高度等于 `innerHeight`（`100dvh` / `h-dvh`）。
- 长页面滚动时底部导航仍在视口内。
- 页头带 `pt-safe`，样式表含 `env(safe-area-inset-top)`；底栏含 `env(safe-area-inset-bottom)`。
- 行程表单和助手输入的计算字号 ≥ 16px。
- 样式表含 `@media (display-mode: standalone)`。`addInitScript` 让 `matchMedia('(display-mode: standalone)')` 为真，外壳 `overscroll-behavior` 为 `none`，高度仍是 `100dvh`。

`e2e/stage12-a11y.spec.ts`：纸（浅色）与夜（深色，`lvxu-preferences` 写 `theme: "dark"`，并 `emulateMedia({ colorScheme: "dark" })`）。页面：`/`、`/explore`、`/profile`、`/trips/trip-kyoto`、预算、预订、清单、攻略，以及打开的助手。锁定按钮的可访问名称必须匹配 `/锁定|解锁/`。只收集 impact 为 serious 或 critical 的违规；修到通过。`prefers-reduced-motion: reduce` 时页面过渡的计算样式没有非零 `transform` 动画（用 `emulateMedia`）。

截图放在 `docs/stage12/screenshots/`，文件名带 `iphone`/`desktop` 和 `paper`/`night`：行程列表、行程详情、预算、我的、助手。另外复制一份到 `/opt/cursor/artifacts/`，供 PR 正文引用。画面里不出现密钥。

Lighthouse 对本地 `vite preview`（生产构建）跑 performance、accessibility、best-practices、pwa。分数写入验收文档，不写进会部署的运行时代码。证书用忽略错误的无头 Chrome。不拿 Lighthouse 打生产，避免给线上增加负载以外的干扰；生产只做下面的只读冒烟。

## 无障碍与动效要改的点

- `src/components/ui/button.tsx`：`default` / `lg` 至少 `min-h-11`（44px）。`icon` 改为 44×44（`size-11`）。焦点环保持现有的 `focus-visible`。
- `src/components/ui/input.tsx`、`textarea.tsx`、`select-field.tsx`：高度至少 44px。字号继续 `text-base md:text-sm`。
- `timeline-editor.tsx` 的时间输入、`assistant-sheet.tsx` 的调整说明：去掉小于 16px 的字号，补上与输入框一致的焦点环。锁定按钮保留并明确中文 `aria-label`；图标 `aria-hidden="true"`，避免 SVG 把名称算空。若 axe 仍报空名称，按它指出的节点改，不改锁定语义。
- 助手差异行：整行是 `<label>`，点击区域至少 44px。复选框本身可以小于 44px，但命中区域是整行。
- `trip-timeline.tsx` 里可点的名称补 `focus-visible` 环。
- `money-figure.tsx`：改为最终金额的短透明度过渡；减少动态效果或省流时直接显示最终文字，不再逐帧改 `textContent`。
- `src/index.css`：`@custom-variant standalone` 对应 `@media (display-mode: standalone)`。该媒体查询下 `html`、`body` 与 `[data-app-shell]` 为 `height: 100dvh`、`overscroll-behavior: none`。`html[data-display="standalone"]` 写同一组规则，供测试同步。
- `src/components/theme-sync.tsx`（或同级的小模块）：监听 `display-mode`，设置 `document.documentElement.dataset.display`。不新增设置项。
- `app-shell.tsx`：加上 `data-app-shell`。
- 对比度：先跑 axe。若 `--muted-foreground` 在纸色或夜色上失败，只把对应的 oklch 亮度调到通过 AA，不改朱砂和版面。

## 安全

新增 `worker/security-headers.ts`：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=15552000; includeSubDomains`（无 preload）
- `X-XSS-Protection: 0`
- `X-Robots-Tag: noindex`（个人站点，不进索引；不是公开发布）
- `Content-Security-Policy`：`default-src 'self'`；`script-src 'self' https://webapi.amap.com 'unsafe-eval'`（高德 JS API 2.0 会动态插脚本并使用 eval，这是地图能工作的前提，写进审计）；`style-src 'self' 'unsafe-inline'`；`style-src-attr 'unsafe-inline'`（Motion 写 transform）；`img-src 'self' data: blob: https://webapi.amap.com https://*.amap.com https://*.is.autonavi.com`；`connect-src 'self' https://webapi.amap.com https://restapi.amap.com https://*.amap.com https://*.is.autonavi.com`；`worker-src 'self' blob:`；`font-src 'self' data:`；`manifest-src 'self'`；`object-src 'none'`；`base-uri 'self'`；`form-action 'self'`；`frame-ancestors 'none'`。不用 COEP/COOP require-corp。

`worker/index.ts` 在返回 `/api` 与 `/_AMapService` 响应前套上这些头，不覆盖已有的 `cache-control`（地点检索的短缓存保持阶段 08）。`public/_headers` 用同一组头覆盖 `/*`，给 HTML、`sw.js`、manifest 和图标。Vite 预览的 `preview.headers` 用同一组，让 e2e 在带 CSP 的生产构建上跑；若 CSP 把外壳拦白，先收紧再放行高德，不放行任意源。

`worker/security-headers.test.ts`：头都在；`cache-control` 不被改掉；CSP 含 `frame-ancestors 'none'` 且不含密钥样子的字符串。

`worker/api.test.ts` 补一条：`AUTH_MODE=owner-key` 且配置了 `OWNER_KEY_SHA256` 时，无密钥访问 `/api/ai/itinerary`、`/api/ai/revise`、`/api/ai/usage`、`/api/map/config`、`/api/auth/check`、`/api/paid/draft`、`/api/admin/health` 都是 401，处理函数不被调用。`/_AMapService` 无 cookie 为 401（现有 proxy 测试已有则只补缺的路径）。`/api/status` 仍是 200，正文不含指纹。

`scripts/scan-secrets.mjs`：扫工作区和 `git log -p`（所有提交）。规则只报文件、提交（如有）和类型：私钥块、`AKIA`、DeepSeek `sk-`、Google API key 形态、PEM、赋值给 `DEEPSEEK_API_KEY` / `AMAP_JS_KEY` / `AMAP_JS_SECURITY_CODE` / `AMAP_WEB_KEY` / `OWNER_KEY_SHA256` / `CLOUDFLARE_API_TOKEN` 的非空字面量。跳过 `node_modules`、`dist`、锁文件里的完整性哈希、本扫描脚本的规则源码、`.dev.vars.example` 的空赋值。stdout 只打印 `file`、`kind`、`commit`，不打印匹配文本。找到即退出码 1。

`.github/workflows/deploy.yml`：在 Deploy 之前增加密钥扫描。Deploy 之后增加 `node scripts/smoke-production.mjs`。冒烟只打 `https://lvxu-ai-travel.lvxu.workers.dev`（可用 `SMOKE_BASE_URL` 覆盖）：

- `GET /` 为 200 且 URL 是 https
- 响应头含上述安全头（静态页）
- 连续 5 次 `GET /` 都成功
- `GET /manifest.webmanifest`（或页面指出的 manifest）与 `GET /sw.js` 为 200
- 不带密钥的 `POST /api/ai/itinerary`、`GET /api/map/config`、`GET /_AMapService/` 为 401
- `GET /api/status` 为 200，且正文（只在内存里检查）不含 `sk-`、`BEGIN`、`AMAP_` 赋值。日志只打状态码和头名称，不打正文。

不在冒烟里使用或打印任何密钥。失败不重试到会打爆限流的次数。

`npm audit --json` 的结论写入审计文档。高危且有不破坏锁定版本的修复才改依赖；没有则记为遗留并写明包名和严重级别，不升级一堆无关系的主版本。

前端产物：构建后确认 `dist` 不含 `DEEPSEEK_API_KEY`、`AMAP_JS_SECURITY_CODE`、`AMAP_WEB_KEY`、`OWNER_KEY_SHA256`、`CLOUDFLARE_API_TOKEN`。高德 JS key 只在已授权的 `/api/map/config` 响应里出现，不进静态产物。

生产只读检查在写审计文档时做一次，同样不带密钥。TLS 只记录协议能握手，不记录证书私钥（本来也拿不到）。

## 要新增的文件

- `docs/STAGE_12_PLAN.md`：本文件，先提交。
- `worker/security-headers.ts`
- `worker/security-headers.test.ts`
- `public/_headers`
- `src/lib/display-mode.ts`：若逻辑放不进 `theme-sync.tsx` 就单独放；优先放进 `theme-sync.tsx`，避免多一个挂载点。能放进现有组件则不新建。
- `e2e/stage12-flows.spec.ts`
- `e2e/stage12-iphone.spec.ts`
- `e2e/stage12-a11y.spec.ts`
- `scripts/scan-secrets.mjs`
- `scripts/smoke-production.mjs`
- `docs/stage12/DEVICE_CHECKLIST.md`：中文真机清单。每项有预期和 `- [ ]`。条目：添加到主屏幕、门禁登录、新建与编辑行程、AI 起草、锁定后局部重排与撤销、地图、预算合计、预订与清单、断网冷启动查看行程、备份导出与导入恢复、打印 PDF、深浅色切换、更新提示。注明自动化替代不了冷启动和打印面板。
- `docs/RELEASE.md`：架构（浏览器 IndexedDB + 同一 Worker 的静态资源与 `/api`）、环境变量名称清单（不含值）、部署与回滚、备份恢复、额度、已知限制。
- `docs/stage12/SECURITY_AUDIT.md`：audit、密钥扫描、门禁、安全头、SW、产物、生产只读结果。不出现密钥值。
- `docs/stage12/ACCEPTANCE.md`：命令结果、Lighthouse 分数、axe 结论、遗留。测试跑完再写。
- `docs/stage12/screenshots/`：核心页面截图。
- `CHANGELOG.md`：本阶段条目，以及 01–11 已发布行为的简短索引（不重写功能）。

## 要修改的文件

- `playwright.config.ts`：两个 project；顶层只留 `baseURL`、`ignoreHTTPSErrors`、webServer。
- `package.json`：开发依赖加入 `@axe-core/playwright`。版本号改为 `1.0.0`（发布标记，不改变运行时）。脚本可加 `audit:secrets`，不把冒烟放进 `npm test`。
- `vite.config.ts`：`preview.headers` 使用与 Worker 相同的安全头，便于 e2e。
- `src/index.css`、`src/components/app-shell.tsx`、`src/components/theme-sync.tsx`
- `src/components/ui/button.tsx`、`input.tsx`、`textarea.tsx`、`select-field.tsx`
- `src/components/timeline-editor.tsx`、`trip-timeline.tsx`、`assistant-sheet.tsx`、`money-figure.tsx`
- `src/components/page-header.tsx`：返回链接的图标 `aria-hidden`。
- `worker/index.ts`：套安全头。
- `worker/api.test.ts`：补门禁路径。
- `src/lib/amap-path.ts` 的测试：越界坐标。只在 `route-line.test.tsx` 缺断言时加。
- `.github/workflows/deploy.yml`：扫描与冒烟。
- `README.md`：链到 `docs/RELEASE.md` 与真机清单；测试命令写明 iPhone WebKit 与桌面 Chromium；说明合并 `main` 才会部署。
- `ROADMAP.md`：阶段 12 改为自动化验收完成，真机清单在合并部署后由使用人执行。

## 不改的文件

- `wrangler.jsonc` 的 `AUTH_MODE`、限额、`run_worker_first`、速率限制绑定。
- DeepSeek 调用、额度账本、高德核对规则、Dexie 版本。
- 助手对话的存储方式。
- Access 的 JWT 验证。不切换到 Access。
- 阶段 08 地点检索的边缘缓存时长。

## 验收时要跑的命令

`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e`（含两个 project）、`node scripts/scan-secrets.mjs`、`npm audit`、本地 Lighthouse、对生产地址的只读冒烟。Playwright 浏览器包含 Chromium 与 WebKit。
