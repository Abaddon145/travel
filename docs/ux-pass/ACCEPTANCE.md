# 体验修订验收

分支 `cursor/ux-pass-1f8b`，从 `a0fcb2d` 拉出。自动化验收在本地生产构建上完成。没有合并 `main`，没有推 `main`，没有执行 `wrangler deploy`，没有启动 iOS IPA 工作流。生产 `https://lvxu-ai-travel.lvxu.workers.dev` 仍是合并前的版本。

计划在 [PLAN.md](./PLAN.md)。交接时的现场记录在 [HANDOFF.md](./HANDOFF.md)。

## 测试

2026-11-11，本机 `npm ci` 之后。Playwright 使用 Chromium 与 WebKit（`npx playwright install --with-deps chromium webkit`）。

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过。eslint 退出码 0，没有 warning |
| `npm run typecheck` | 通过。`wrangler types` 后 `tsc -b` |
| `npm run test` | 通过。46 个文件、136 个测试 |
| `npx playwright test` | 通过。75 个测试，0 失败，约 2.9 分钟。`iphone` 为 WebKit + iPhone 14，只跑 `stage12-*`；`desktop` 为 Chromium 1280×800，跑其余测例（不含 `stage12-iphone`） |
| `npm run build` | 通过。Vite 8.3.5，仍警告 `index` 块超过 500KB |

DeepSeek 与高德在浏览器测试里只走模拟或被中止。配额常量仍是每天 30 次、10 万令牌。`AUTH_MODE` 仍是 `owner-key`。

## 首屏体积

审计基线是单个 JS 1010KB、gzip 312KB。交接时首屏 modulepreload 合计 991474 字节、gzip 307863 字节。行程详情和起草留在首包，离线才能打开详情。

这次构建里 `dist/index.html` 预加载的 JS（原始字节，gzip 为 Node `zlib.gzipSync` level 9，不含时间戳）：

| 文件 | 原始 | gzip |
| --- | ---: | ---: |
| `index-Dyk0-6ok.js` | 580179 | 176432 |
| `repository-BHl7Xy1p.js` | 395820 | 125431 |
| `jsx-runtime-CkXRJ162.js` | 8243 | 3116 |
| `preload-helper-BLdHbfdN.js` | 1519 | 797 |
| `rolldown-runtime-WkwZ5CU-.js` | 599 | 368 |
| 合计 | 986360 | 306144 |

相对交接记录，原始体积少 5114 字节。页面过渡不再引入 `AnimatePresence`，首包因此小了一截。没有为了再减体积把行程详情或起草拆出首包。`npm run build` 打印的约数是 index 580.17 kB / gzip 178.38 kB，repository 395.82 kB / gzip 126.72 kB；文件名会随下次构建变化。CSS `index-DFT-VVUz.css` 61771 字节。

地图画布、助手、预算、预订、清单、攻略仍是打开时再加载的块。

## 这次为了让浏览器测试通过而改的行为

- 时间线操作抽屉还开着时，遮罩盖住页头。测例量完「解锁白川庵」之后先点「关闭」，再点「助手」。`stage12-flows` 的助手测例同样处理。iPhone 测例量完「编辑这一天」里的时间框后先点「取消」，再点「助手」。
- 选中的时间线名称不再用 `text-primary`。底色仍是 `bg-primary/10`。纸色下朱砂字叠在这层底色上大约 4.21:1，低于 4.5；正文色大约 14:1。地图列表本来就是正文色加底色。
- 44px 的断言按四舍五入后的 CSS 像素比较。桌面一次量到 43.9999，按钮的 `h-11` 没有变小。
- 路线核实只出现在选中项、且该项当天还有下一站时。地图测例在两处都核对完之后，重新选中「抵达白川」的第一项，再点「核实步行」。
- 页面过渡改成新页面 0.15 秒淡入，旧页面马上卸下。减少动态效果时不做这段动画。先前用 `AnimatePresence` 淡出，退出动画结束不了，行程页和起草页的「返回」会同时留在无障碍树里。
- 接口状态卡片出现时只做短位移，不再把文字从透明淡入。无障碍扫描会撞上淡入中的朱砂字。

## 文件

相对 `main` 的源码与测试（截图另计）：

- 体验：`src/components/` 下的时间线、地图、抽屉、页头、外壳、助手、用量、密钥表单、空状态；`src/pages/` 的首页、今天、详情、预算、攻略、404；`src/lib/` 的行程阶段、天气、手势、触感、目的地联想、助手会话；`src/hooks/use-visual-viewport.ts`、`src/lazy-pages.tsx`、`src/router.tsx`、`src/index.css`、`src/domain/money.ts`。
- 边缘：`shared/security-headers.ts`、`public/_headers`、`public/robots.txt`、`index.html`、`package.json`（`@capacitor/haptics`）、`ios/App/CapApp-SPM/Package.swift`。
- 浏览器测例：`e2e/ux-pass.spec.ts`，以及 `owner-key`、`persistence`、`screenshots`、`stage08-map`、`stage11-offline`、`stage12-a11y`、`stage12-flows`、`stage12-iphone`。
- 文档：`docs/ux-pass/PLAN.md`、`HANDOFF.md`、本文件。

## 截图

截图都等 0.15 秒的页面淡入结束再拍，避免只剩底栏。`docs/ux-pass/screenshots/`，390×844，另有一张 375 宽的首页：

- `home-390.png`、`home-375.png`：首页分组。
- `today-390.png`：今天、下一站。
- `trip-detail-map-390.png`：展开后的地图和当天列表。
- `budget-390.png`：未超支时实际花费不用强调色。

`docs/stage07` 到 `docs/stage12` 的截图由同一轮 Playwright 重新写入。

## 遗留

- 没有复测 Lighthouse。合并并部署后再跑。
- 没有生产冒烟。线上仍是旧构建。
- 真机未测：刘海与状态栏回顶、键盘顶起抽屉、Capacitor 触感。
- Vite 仍警告首包 `index` 超过 500KB。详情和起草留在首包，是为了离线能打开。
- 若 PR 上的 GitHub Actions 因账单或消费上限没有启动，与仓库最近一次生产部署失败是同一类情况，本轮不用空提交或本地 `wrangler deploy` 绕过。
