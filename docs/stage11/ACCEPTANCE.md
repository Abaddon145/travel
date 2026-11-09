# 阶段 11 验收

iPhone 所需的安装元信息、离线外壳、JSON 备份和可打印攻略都在这台设备上完成。备份不上传。门禁仍是私人密钥，没有切换到 Access。

## 测试

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run test` | 39 个文件、119 个测试通过 |
| `npm run build` | 通过。生成的 `sw.js` 对 `/api/` 与 `/_AMapService/` 的 GET、POST、PUT、PATCH、DELETE、HEAD 使用 `NetworkOnly`，导航回退排除这两段，并且只在收到 `SKIP_WAITING` 后才跳过等待 |
| `npx playwright test e2e/stage11-offline.spec.ts e2e/persistence.spec.ts` | 通过。离线时仍能看到京都行程，地图核对停在「核对需要网络」，生成按钮不可用。持久化测试里「白川庵」「清水寺」改用时间线标记，不再和地图列表抢同一个文本 |

截图在 `docs/stage11/screenshots/`：`iphone-install.png`、`iphone-offline.png`、`iphone-offline-trip.png`、`iphone-backup-export.png`、`iphone-import-preview.png`、`iphone-import-success.png`、`iphone-guide.png`、`iphone-update.png`，以及同名的 `desktop-*`。视口是 390×844 和 1280×800。

本地预览由 Playwright 起在 `https://127.0.0.1:43128`。没有改线上门禁，也没有部署。

## 方案

- 安装：manifest `id` 为 `/`，`display: standalone`。`apple-touch-icon` 为不透明的 180、167、152。另有 192、512 和 maskable。浅色与深色 `theme-color` 保持原来的纸色和深色。iPhone 竖屏启动图按设备像素生成，浅色纸色与深色各一套，不放进预缓存。
- 更新：`registerType` 为 `prompt`，不打开 `skipWaiting`。底部出现「有新版本」时，稍后只藏起提示，刷新才激活新的服务工作线程。`clientsClaim` 打开，让第一次安装后的页面被接管。截图用 `?sw-update=1` 露出同一条提示，因为一次预览里没有第二版外壳。
- 离线：外壳预缓存。行程在 IndexedDB。断网时顶部说明已保存的行程仍可看。生成、助手、地图核对和云端接口停在明确的降级，不发请求，也不估算距离。
- 备份：JSON 带 `schemaVersion: 7`，包含全部 14 张 Dexie 表，不含私人密钥。导入前校验和预览。合并按较新的 `updatedAt`（没有则 `fetchedAt`、`createdAt`）。替换在同一个事务里清空再写入，中途失败整段撤回。版本 1 的扁平行程会拆成按天的日程。
- 攻略：不用 jsPDF，也不在 Worker 上生成 PDF。中文走系统字体。页面是打印预览，iPhone Safari 的打印面板可以存成 PDF，离线也能排。

## 仍要注意

- 没有在真机 iPhone 上安装。390 宽的界面、manifest 和 Apple 元信息已在桌面浏览器里核对。
- Playwright 的 `context.setOffline(true)` 会让新的文档导航直接变成 `ERR_INTERNET_DISCONNECTED`，服务工作线程来不及应答。测试因此在已经打开的应用上断网，再查看行程和降级界面。真机从主屏幕冷启动离线，要等装到手机上再看。
- 阶段 08 的地点检索仍使用 Worker 边缘缓存，浏览器服务工作线程不存这些响应。
- 阶段 09 的两条遗留没有动：锁定按钮的无障碍名称为空；助手对话只在面板打开时留着。
