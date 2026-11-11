# 把旅序打进 iOS 安装包

先调查，再改代码。网页版继续走同一个生产源的相对路径、cookie、Service Worker 和响应头 CSP。壳改为加载包内的 `dist`，断网仍能看、能改本机数据。AI 和高德在手机联网时访问现有 Worker，不在 App 里管理密钥。

## 调查

现在 `capacitor.config.ts` 把 `server.url` 设成 `https://lvxu-ai-travel.lvxu.workers.dev`。`webDir` 虽是 `dist`，壳打开的是线上页面。`docs/ios/SIDELOAD.md` 说明了原因：相对路径 `/api`、`SameSite=Strict` 的 `lvxu_map`、CSP `'self'`、Service Worker 不能注册在 `capacitor://` 上。

鉴权已经有两条呈现方式，不必新造一种。`worker/owner-key.ts` 的 `readPresentedOwnerKey` 接受 `Authorization: Bearer` 和 `X-Lvxu-Owner-Key`。`AUTH_MODE` 仍是 `owner-key`。网页客户端把私人密钥放在本机 `localStorage`，只附在 `/api/paid|admin|auth|ai|map` 上。`/_AMapService` 不走这套头：高德 JS SDK 自己发请求，带不上 `Authorization`。验证通过后，Worker 给 `/api/auth/check` 和 `/api/map/config` 写 `lvxu_map`，属性是 `HttpOnly; Secure; SameSite=Strict`。代理只认这张 cookie。

地图有两条路。地点、路线、地理编码走 `/api/map/*`，服务端用 `AMAP_WEB_KEY`。底图走 JS API，`AMAP_JS_KEY` 在控制台绑定生产域名，安全密钥只在 `/_AMapService` 里追加为 `jscode`。`src/components/amap-canvas.tsx` 把 `serviceHost` 设成当前页面源加 `/_AMapService`。

CSP 的唯一来源是 `shared/security-headers.ts`。Worker 响应和 `public/_headers` 用它。`index.html` 没有 CSP meta。壳如果加载本地文件，拿不到 Worker 的响应头。

Service Worker 只在 `src/pwa/register.ts` 里注册（`injectRegister: false`）。Workbox 对 `/api/` 和 `/_AMapService/` 使用 `NetworkOnly`。

官方行为：

- Capacitor 配置：`webDir` 是打包后的网页目录。不设 `server.url` 时，iOS 用本地资源。默认源是 `capacitor://localhost`（`iosScheme` 默认 `capacitor`，`hostname` 默认 `localhost`）。本仓库把 `hostname` 改成生产主机，源变成 `capacitor://lvxu-ai-travel.lvxu.workers.dev`。
- Capacitor 8 的 `CAPInstanceDescriptor.normalize()` 会丢掉 `WKWebView` 已经接管的 scheme。`http` 和 `https` 不能当作本地 scheme，会被退回 `capacitor`。因此做不到「页面源是 `https://生产域名`、文件却来自安装包」。
- `WebViewAssetHandler` 只按本地文件响应这个 scheme，不会把 `/api` 转到网络。`Router` 对没有扩展名的路径回退到 `index.html`，应用内路由刷新仍可用。
- MDN：`SameSite=Strict` 只在设置该 cookie 的站点上发送，跨站 `fetch` 带不过去。跨源且要带 cookie 时，响应不能用 `Access-Control-Allow-Origin: *`，还必须有 `Access-Control-Allow-Credentials: true`。不带凭据的请求则不必开这扇门。
- Capacitor HTTP 插件能绕过 WebView 的 CORS，但 Ionic 的说明是：服务端能正确配置 CORS 时不要开它。它会改写全部 `fetch` / XHR，也解决不了高德 SDK 不会附私人密钥的问题。

## 取舍

保留网页版的同站 cookie。不把 `lvxu_map` 改成 `SameSite=None`，也不开 `CapacitorHttp`。不把高德安全密钥放进安装包。不改 `AUTH_MODE`、DeepSeek 模型、每日 10 万令牌和 30 次请求。Cloudflare Access 的代码留着，不切过去。

壳的页面源是 `capacitor://lvxu-ai-travel.lvxu.workers.dev`。`iosScheme` 仍是 `capacitor`，不设 `server.url`。主机名用已经写在高德 JS API 域名白名单里的生产主机。控制台拒绝把 `localhost` 加进这份白名单，提交时提示「有不符合规范的域名」。这只改 WebView 报告的主机，不把页面变成 `https://` 生产站：scheme 不同，cookie 仍然跨站，Capacitor 也不会把 `/api` 转到 Worker。接口仍是绝对地址 `https://lvxu-ai-travel.lvxu.workers.dev`，继续带 `Authorization: Bearer`。

Worker 对两个壳源回显 CORS 并允许凭据：当前的 `capacitor://lvxu-ai-travel.lvxu.workers.dev`，以及已安装旧包的 `capacitor://localhost`。不使用 `*`。网页版自己的 `https://` 源不加这些头，`Set-Cookie` 仍是 `SameSite=Strict`。壳请求不写 `lvxu_map`。高德 SDK 若把 XHR 设成 `withCredentials`，回显具体源并允许凭据，浏览器才不会丢掉响应。

`/_AMapService` 在 cookie 有效或私人密钥有效时放行。只呈现了错误密钥时才计入现有的失败限流；没带密钥的 401 维持原样，避免底图的匿名探测把地址打进限流。上游请求仍只转发 `accept`，不把密钥或 cookie 交给高德。

壳不注册 Service Worker。构建出的 `index.html` 写入与响应头同一份 CSP 的 meta（去掉 meta 不支持的 `frame-ancestors`，响应头仍保留它）。`connect-src` 和 `img-src` 写上 Worker 源。对网页版，这个源就是 `'self'`，没有多放行别的主机。高德和 Open-Meteo 本来就在策略里。

## 文件

| 文件 | 改动 |
| --- | --- |
| `shared/shell-origin.ts` | Worker 源、壳 scheme、hostname、当前壳源，以及旧的 `capacitor://localhost`。客户端、CORS 和 Capacitor 配置共用。 |
| `shared/security-headers.ts` | `connect-src`、`img-src` 加上 Worker 源。导出给 meta 用的策略文本。 |
| `public/_headers` | 与共享策略保持一致。 |
| `capacitor.config.ts` | 去掉 `server.url`。`webDir` 仍是 `dist`。`iosScheme` 为 `capacitor`，`hostname` 为 `lvxu-ai-travel.lvxu.workers.dev`。不设 `allowNavigation`，不开明文。 |
| `worker/cors.ts` | 给当前壳源和旧的 `capacitor://localhost` 的 `/api` 与 `/_AMapService` 写 CORS，并处理预检。 |
| `worker/index.ts` | 预检在鉴权之前返回。API 与地图代理套上壳 CORS。壳请求不写 `lvxu_map`。 |
| `worker/map/proxy.ts` | cookie 或私人密钥都可以过代理。错误密钥走现有失败限流。 |
| `src/lib/api-origin.ts` | 仅在原生壳把 `/api` 和 `/_AMapService` 解析到 Worker。网页版仍是相对路径。 |
| `src/lib/native-proxy-auth.ts` | 仅在壳里，给打向 Worker `/_AMapService` 的 `fetch` 和 XHR 补上 `Authorization`。 |
| `src/lib/owner-key.ts`、`api-status.ts`、`ai-client.ts`、`assistant-client.ts`、`map-client.ts` | 请求地址走 `api-origin`。密钥仍只按路径附在受保护接口上。 |
| `src/components/amap-canvas.tsx` | 壳里的 `serviceHost` 指向 Worker 上的 `/_AMapService`。网页版仍用当前源。JS API 加载失败时在画布里写出中文说明。 |
| `src/components/api-status-card.tsx` | 壳里的网络错误不再提示去开本地接口服务。网页文案不变。 |
| `src/pwa/register.ts`、`src/main.tsx` | 壳里不注册 Service Worker，并在启动时装上地图代理的请求头补丁。 |
| `vite.config.ts` | 构建时把 CSP meta 写入 `index.html`。 |
| `.github/workflows/ios-build.yml` | 网页源变更也触发未签名 IPA，这样包内资产跟得上 `dist`。 |
| `docs/ios/SIDELOAD.md` | 改成说明本地打包、离线范围、AI/地图要网络、Sideloadly，以及壳和 Safari 不共享存储。 |

不改 `wrangler.jsonc` 的 `AUTH_MODE`、模型名和每日额度。不部署。

## 验证

`npm run lint`、`npm run typecheck`、`npm run test`、`npm run test:e2e`、`npm run build`。

单测要锁住：网页版相对路径和 `SameSite=Strict` cookie 还在；壳源才有 CORS，且没有 `*`；地图代理在 cookie 或私人密钥下都能追加 `jscode`，上游看不到密钥；壳里的 `/_AMapService` 请求才带上 `Authorization`。

## 做不到的部分

GitHub Actions 不能用免费 Apple ID 签名，也不能装到真机。本变更不执行 `wrangler deploy`。线上 Worker 若还没部署这一版 CORS，新源 `capacitor://lvxu-ai-travel.lvxu.workers.dev` 的接口会被浏览器拦住；旧包的 `capacitor://localhost` 在部署前后都继续放行。地点和路线走服务端 Web 服务密钥，不依赖 JS API 的域名白名单。

## 底图仍可能空白

高德 JS API 的域名白名单核对的是脚本请求的 Referer 主机，不是 `Origin`。WKWebView 加载 `capacitor://` 这类自定义 scheme 时，子资源的 GET 经常不带 Referer：Capacitor 的问题记录里，Safari 调试能看到 `Origin: capacitor://localhost`，但没有 Referer；YouTube 嵌入在同一类源上也会因为没有 Referer 被拒绝。JavaScript 不能自己写 Referer。因此只把主机名改成白名单里的域名，真机上仍可能加载失败。失败时画布写明「底图没有加载。地点和路线仍可使用；若它们已经显示，多半是高德没有接受当前页面来源。」

不要靠清空高德白名单来修，也不要把安全密钥放进安装包。若真机确认请求里没有 Referer，再考虑这两条，都比改主机名重：

- 由 Worker 代拉 `https://webapi.amap.com/maps`，请求上带 `Referer: https://lvxu-ai-travel.lvxu.workers.dev/`，后续脚本也从 Worker 转出。`jscode` 仍只在 `/_AMapService` 里追加。壳的 CSP `script-src` 要加上 Worker 源。瓦片域名若也核对 Referer，这条仍然不够。
- 单独做一个 HTTPS 地图页，只让壳用 iframe 嵌它，让地图文档自己处在 `https://` 源上。那一页要放宽 `frame-ancestors`，并用 postMessage 传选中的地点。不能把本机行程换成线上整页。

换主机名会换掉 WebView 源。已装旧包里的 IndexedDB 和私人密钥留在 `capacitor://localhost`，新包看不到。装新包之前先在旧包里导出备份，装好后再导入，并在「我的」里重新保存私人密钥。同一个 Bundle ID 不会把两个源的存储并到一起。

WKWebView 大约从 iOS 14.6 起把自定义 scheme 当成安全上下文，`crypto.randomUUID` 应还能用来新建行程。规范里的可信源并不包括非 localhost 的自定义主机，装到真机后要确认还能新建行程。壳仍然不注册 Service Worker。
