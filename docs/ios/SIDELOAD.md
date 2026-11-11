# 在 Windows 上安装未签名的旅序

iOS 壳用 Capacitor 8 装进已经构建好的网页。GitHub Actions 的 macOS 机器只产出未签名的 `.ipa`。签名在你自己的 Windows 上完成，用免费 Apple ID 和 Sideloadly。

## 壳里是本地页面

`capacitor.config.ts` 不再设置 `server.url`。`webDir` 是 `dist`。装好以后，App 打开的是包里的页面，源是 `capacitor://lvxu-ai-travel.lvxu.workers.dev`，不是线上的 `https://` 站点，也不是更早安装包里的 `capacitor://localhost`。

行程、预算、装备、备份的导入和导出都在本机（IndexedDB / Dexie）。线上站点打不开时，这些仍然可以看、可以改。断网也可以打开 App。

下面这些需要手机联网，并且要能访问现有的 Cloudflare Worker：

- AI 助手
- 高德地图（地点、路线，以及底图走 Worker 上的 `/_AMapService`）
- 天气
- 在「我的」里验证私人密钥

Worker 地址仍是 `https://lvxu-ai-travel.lvxu.workers.dev`。密钥留在 Worker 上，不写进 App。

网页版还是原来的 HTTPS 站点：相对路径 `/api`、`SameSite=Strict` 的 `lvxu_map` cookie、Service Worker 和 CSP 都不变。壳和网页不共用这套 cookie。壳在联网时用本机保存的私人密钥，以 `Authorization` 访问 Worker。

壳里不注册 Service Worker。页面已经在安装包里，更新 App 要重新签名安装，不是网页上的刷新提示。

## 从旧包装上来

旧包的本机行程和私人密钥记在 `capacitor://localhost`。这一版换了页面主机，打开后会像是空的。换之前在旧包的「我的」里导出备份；装好新包后导入，并重新保存私人密钥。保持 Bundle ID 只让系统把它当成同一个 App，不会把两个页面源的存储并到一起。

底图走高德 JS API。白名单里已有生产域名，控制台不接受 `localhost`。新包把页面主机设成这个生产域名，但 iOS 的 WebView 对 `capacitor://` 可能不发送 Referer。展开地图后若看到「底图没有加载……」，已核对的地点和已保存的路线仍可使用。不要把高德密钥写进 App。新包的接口要等 Worker 放行 `capacitor://lvxu-ai-travel.lvxu.workers.dev` 之后才通；在那之前，已安装的旧包仍走原来的源。

没有设置 `allowNavigation`，也没有打开 cleartext。壳不把整个窗口导航到别的网站。

Bundle ID 是 `app.lvxu.travel`。显示名是「旅序」。

## 产物从哪来

工作流名称是「iOS unsigned IPA」，文件是 `.github/workflows/ios-build.yml`。

- 触发：手动运行，或 pull request 改到 `ios/**`、`capacitor.config.ts`、`assets/**`、`scripts/generate-icons.mjs`、这个工作流、`package.json`、`package-lock.json`、`src/**`、`index.html`、`public/**`、`shared/**`、`vite.config.ts`。
- 机器：`macos-26`。这是当前 GitHub 托管的 macOS 镜像，也是 `macos-latest` 指向的版本。
- 构建会执行 `npm run build` 和 `npx cap sync ios`，把 `dist` 打进包。
- 权限只有 `contents: read`。步骤里不读取任何 secret、证书或 Apple ID。
- 上传的 artifact 名称是 `lvxu-unsigned-ipa`，里面是 `lvxu-unsigned.ipa`，保留 14 天。

## 安装

1. 打开这次工作流运行，下载 artifact `lvxu-unsigned-ipa`，解压得到 `lvxu-unsigned.ipa`。
2. 安装 [Sideloadly](https://sideloadly.io/)。Windows 上还要装 Apple 的设备驱动：从 Apple 官网安装 iTunes（用 apple.com 的安装包），或安装「Apple 设备」和 Apple Mobile Device Support。装好后，数据线连上 iPhone，手机会问是否信任这台电脑。
3. 打开开发者模式：设置 → 隐私与安全性 → 开发者模式。按提示重启。这项有时要等 Sideloadly 第一次尝试安装后才出现。
4. 打开 Sideloadly，把 `lvxu-unsigned.ipa` 拖进去，选中这台 iPhone。Apple ID 和密码只在本机 Sideloadly 里输入。
5. 安装完成后，在 iPhone 上打开设置 → 通用 → VPN 与设备管理，信任刚装上的开发者描述文件，再打开「旅序」。
6. 进入「我的」，重新保存私人密钥并验证。App 里的 WebView 和 Safari 不共享本地存储，Safari 里保存的密钥不会跟着过来。行程、预算这些也在本机 IndexedDB 里。需要带走 Safari 里的行程时，先在 Safari 的「我的」导出备份，再在 App 里导入。
7. 免费 Apple ID 的签名大约每 7 天失效。用同一个 Apple ID、同一个 Bundle ID `app.lvxu.travel` 对这份 ipa 再签一次。Bundle ID 不变时，系统把它当成同一个 App。页面源不变的重签不会清掉本机行程；若这一包把源从 `capacitor://localhost` 换成 `capacitor://lvxu-ai-travel.lvxu.workers.dev`，要先按上一节导出备份。

Apple ID 密码只留在本机 Sideloadly。不要写进仓库、工作流、日志或截图。
