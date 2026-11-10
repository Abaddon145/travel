# 在 Windows 上安装未签名的旅序

iOS 壳用 Capacitor 8 包住现有站点。GitHub Actions 的 macOS 机器只产出未签名的 `.ipa`。签名在你自己的 Windows 上完成，用免费 Apple ID 和 Sideloadly。

## 为什么壳加载线上地址

`capacitor.config.ts` 里 `server.url` 是 `https://lvxu-ai-travel.lvxu.workers.dev`。壳打开的就是这个源，而不是把 `dist` 塞进 `capacitor://`。

这个取舍是为了让现有 PWA 原样工作：

- 接口都是相对路径 `/api`。WebView 的源必须是这个站点，请求才会打到 Worker。
- 地图代理 `/_AMapService` 依赖第一方 cookie `lvxu_map`，属性是 `SameSite=Strict`。自定义 scheme 带不上这张 cookie。
- 内容安全策略是 `'self'`。脚本、Worker 和接口都按这个源校验。
- Service Worker 不能在 `capacitor://` 自定义 scheme 上注册。线上地址仍然是 HTTPS，注册方式和 Safari 一样。

没有设置 `allowNavigation`，也没有打开 cleartext。壳只打开上面的 HTTPS 源，不放行别的域名，也不允许明文 HTTP。

Bundle ID 是 `app.lvxu.travel`。显示名是「旅序」。

## 产物从哪来

工作流名称是「iOS unsigned IPA」，文件是 `.github/workflows/ios-build.yml`。

- 触发：手动运行，或 pull request 改到 `ios/**`、`capacitor.config.ts`、`assets/**`、`scripts/generate-icons.mjs`、这个工作流、`package.json`、`package-lock.json`。
- 机器：`macos-26`。这是当前 GitHub 托管的 macOS 镜像，也是 `macos-latest` 指向的版本。
- 权限只有 `contents: read`。步骤里不读取任何 secret、证书或 Apple ID。
- 上传的 artifact 名称是 `lvxu-unsigned-ipa`，里面是 `lvxu-unsigned.ipa`，保留 14 天。

## 安装

1. 打开这次工作流运行，下载 artifact `lvxu-unsigned-ipa`，解压得到 `lvxu-unsigned.ipa`。
2. 安装 [Sideloadly](https://sideloadly.io/)。Windows 上还要装 Apple 的设备驱动：从 Apple 官网安装 iTunes（用 apple.com 的安装包），或安装「Apple 设备」和 Apple Mobile Device Support。装好后，数据线连上 iPhone，手机会问是否信任这台电脑。
3. 打开开发者模式：设置 → 隐私与安全性 → 开发者模式。按提示重启。这项有时要等 Sideloadly 第一次尝试安装后才出现。
4. 打开 Sideloadly，把 `lvxu-unsigned.ipa` 拖进去，选中这台 iPhone。Apple ID 和密码只在本机 Sideloadly 里输入。
5. 安装完成后，在 iPhone 上打开设置 → 通用 → VPN 与设备管理，信任刚装上的开发者描述文件，再打开「旅序」。
6. 进入「我的」，重新保存私人密钥并验证。App 里的 WebView 和 Safari 不共享本地存储，Safari 里保存的密钥不会跟着过来。行程、预算这些也在本机 IndexedDB 里。需要带走 Safari 里的行程时，先在 Safari 的「我的」导出备份，再在 App 里导入。
7. 免费 Apple ID 的签名大约每 7 天失效。用同一个 Apple ID、同一个 Bundle ID `app.lvxu.travel` 对这份 ipa 再签一次。保持 Bundle ID 不变，这台手机上的本地数据才还在原来的 App 里。

Apple ID 密码只留在本机 Sideloadly。不要写进仓库、工作流、日志或截图。
