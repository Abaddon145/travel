# 阶段 12 验收

自动化验收在本地生产构建上完成。没有推 `main`，没有合并，没有执行 `wrangler deploy`。生产地址目前仍是阶段 11 的部署；本分支的安全头要等合并后由 GitHub Actions 带上去。

真机项见 [DEVICE_CHECKLIST.md](./DEVICE_CHECKLIST.md)，由使用人在部署后勾选。

## 测试

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run test` | 42 个文件、124 个测试通过 |
| `npm run build` | 通过。`dist/_headers` 与 Worker 使用同一组安全头。`/api/` 与 `/_AMapService/` 仍是 `NetworkOnly` |
| `npm run test:e2e` | 72 通过。`iphone` 为 WebKit + iPhone 14；`desktop` 为 Chromium 1280×800。DeepSeek 与高德只走模拟或被中止 |
| `node scripts/scan-secrets.mjs` | 无发现。工作区与 git 历史都扫过，输出只有类型和路径 |
| `npm audit` | 19 项：0 危急、0 高、16 中、3 低。都在开发工具链，没有为了清零去升主版本 |

Lighthouse：本地 `https://127.0.0.1:43128` 的生产预览。Lighthouse 12.8.2 给出性能 89、无障碍 100、最佳实践 100。12 已去掉 PWA 分类，用 11.7.1 单独跑 PWA，分数 100。

axe（`@axe-core/playwright`，WCAG 2.0/2.1/2.2 的 A 与 AA）在纸色和夜色下跑了行程、探索、我的、日程、预算、预订、清单、攻略和助手。严重与危急为 0。锁定按钮名称是「解锁白川庵」，触控边长至少 44px。

## 修过的质量问题

- 图标按钮、表单控件和清单复选框的可点区域至少 44px。手机宽度上输入框计算字号至少 16px，避免 Safari 聚焦时放大页面。
- 未授权状态的说明原先用 90% 不透明度的朱砂色，对比度 4.44，低于 4.5。改为不透明的同色。
- 可滚动的页面内容可以聚焦。锁定图标不再参与无障碍名称计算。
- 金额只做短的透明度变化。减少动态效果时页面位移时长为 0。
- 主屏幕（`display-mode: standalone`）下外壳高度为 `100dvh`，并关闭文档级回弹。

## 截图

`docs/stage12/screenshots/`：`iphone` / `desktop` × `paper` / `night` × 行程列表、日程、预算、我的、助手。

## 仍要注意

- 真机冷启动、添加到主屏幕、打印面板和系统分享不在这次自动化里。
- 助手对话仍只留在当前页的内存里。关掉再打开还在；刷新或离开行程就没了。已经应用的修改在版本记录里。这不是小修补：要跨刷新保留就得新的存储，阶段 09 明确不做，本阶段不改。
- `GET /api/status` 仍不要求密钥。它不调用付费接口，也不返回密钥、指纹或邮箱。「我的」用它区分「尚未配置」和「未授权」。
- 内容安全策略为高德 JS API 保留了 `https://webapi.amap.com` 和 `'unsafe-eval'`。没有使用会挡住瓦片的 `require-corp`。
- Playwright 的断网不能代替主屏幕冷启动。阶段 11 的说明仍然有效。
