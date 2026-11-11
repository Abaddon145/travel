# 体验修订交接

分支 `cursor/ux-pass-1f8b`，从 `a0fcb2d` 拉出。未合并 `main`，未部署。工作区是未完成的体验修订，单元测试已过，Playwright 还没有一整轮全绿。

计划在 [PLAN.md](./PLAN.md)。审计原文是 `uploads/AUDIT.md`。

## 已经做完的

代码按计划改过，并跑通 `eslint`（0 warning）、`npm run typecheck`、`npm run test`（46 个文件、136 个测试）。下面这轮构建是**当前树**（行程详情和起草重新打进首包之后）的产物。

- P0：收起地图只留「n 个地点 · n 已核对」；路段按天分组、当天编号、不连跨天；验证密钥成功后让 `ai-usage-remote` 和 `api-status` 失效；离线文案放进粘性页头并带 `pt-safe`，写成「离线中 · 行程可查看」。
- P1：时间线默认只读，点项目开操作抽屉；左滑删除、长按拖动排序，抽屉里仍有上移/下移/锁定/编辑/删除。时段锁定放进「编辑这一天」。文档滚动 + `ScrollRestoration`，底部标签固定。页面过渡约 0.15s，不再 `mode="wait"`。「探索」改成「今天」（`/explore` 路径不变）：倒计时或第几天、下一站、Open-Meteo 天气。首页按即将出发/进行中/已结束分组，删除收进「更多」并保留左滑。用量主界面是「今日 n/30」，令牌和美元放进折叠。私人密钥改成「保存并验证」，起草未授权、地图未授权、助手未授权时就地出现同一张表单。抽屉跟随 `visualViewport`，保存/取消在表单顶部。展开的地图吸在页头下，选中项有底色，标记在未减少动态效果时跳动，展开状态记在 `sessionStorage`。刷新后重画已选路线并 `setFitView`。预算、预订、清单、攻略、地图画布、助手仍然 `lazy()`。
- P2：排序和锁定不再弹成功提示；版本恢复的确认写在抽屉里，并先给出天数和项目名。预算「实际」只在超出预计时用朱砂（`data-over`）。返回链接在有历史时 `navigate(-1)`。按钮按下缩小；Capacitor 壳加了 `@capacitor/haptics@8.0.2`，`ios/App/CapApp-SPM/Package.swift` 已由 `cap sync` 写入。404 和找不到行程用 `MissingState`。兴趣改标签，目的地有本地联想。助手对话进 `sessionStorage`。`revise` 用量写入本机 `aiUsage`。`/assets/*` 为一年 `immutable`；`public/robots.txt` 为 `Disallow: /`。`connect-src` 增加 Open-Meteo。

## 还没做完

没有再跑完一整轮 `npx playwright test`。不要把下面的修补当成已经验收。

最近一次只跑桌面「助手抽屉与锁定按钮有名称」（`scroll-margin` 已写进 `src/index.css` 之后，2026-11-11）仍然失败，2 个测试，各 120s 超时：

- `e2e/stage12-a11y.spec.ts` 纸夜 light / dark，「助手抽屉与锁定按钮有名称」。
- 点开「白川庵」并确认「解锁白川庵」至少 44px **已经通过**。超时发生在下一步 `getByRole('button', { name: '助手' })`。操作抽屉还开着，遮住页头，点击一直等不到。
- 先前猜是粘性页头挡住时间线名称，所以加了 `scroll-margin-top`。这次日志说明卡点是页头上的「助手」，不是名称按钮。修法应是测例在点「助手」前先点抽屉的「关闭」，和 `e2e/persistence.spec.ts`、`e2e/screenshots.spec.ts` 里已经加上的关闭一样。需要再跑才能确认。

更早一整轮（18 failed / 75，在重新打进详情与起草、以及 `.first()`、关闭抽屉等修补**之前**）失败过、后来改了源或测例、但**没有整轮复测**的项目：

| 测例 | 当时的原因 | 已改、未复测 |
| --- | --- | --- |
| `stage12-flows` 助手撤销 | 解锁按钮默认不在页面上 | 先点时间线名称 `.first()` |
| `stage12-flows` 地图、`stage08-map` | 「1. 白川庵」跨天出现两次，strict mode | locator `.first()` |
| `stage11-offline`、`stage12-flows` 离线进详情 | 详情页 `lazy()` 后，首屏离线时块还没进缓存 | 详情和起草改回首包静态引入 |
| `stage12-iphone` 内部滚动 / 100dvh | 已改成文档滚动，壳比视口高 | 测例改为文档滚动、标签固定、壳高度至少一屏 |
| `stage12-iphone` 锁定时间 16px | 时间框进了「编辑这一天」 | 测例先点「编辑抵达白川」 |
| `stage12-iphone` 独立窗口高度差 21px | `min-height: 100dvh` 不再强制等于 `innerHeight` | 断言改成高度不少于视口 |
| `persistence`、`screenshots` | 项目抽屉开着，点不到「编辑行程」/「版本记录」 | 先点「关闭」 |
| `ux-pass`「下一站」 | `CardTitle` 不是 heading | 「下一站」「天气」改成 `h2` |

`npx playwright install --with-deps chromium webkit` 已在这台机器做过。换机器要重装。

还没写 `docs/ux-pass/ACCEPTANCE.md`。没有 Lighthouse 复测。生产 `https://lvxu-ai-travel.lvxu.workers.dev` 没有这次的构建。真机（刘海、状态栏回顶、键盘、Capacitor 触感）都没测。

## 决定

- 行程详情和起草留在首包。离线测试在服务线程接管之前就要打开它们；`registerType: "prompt"` 时动态块还没进预缓存。地图画布和助手仍在打开时再加载。预算、预订、清单、攻略保持路由级 `lazy()`。`zod/mini` 没换，本地校验和首页读库绑在一起。
- 配额仍是 30 次 / 10 万令牌。没有结果的路线不估算距离。
- 成功提示只拿掉排序、锁定，以及版本恢复的 toast。表单保存的成功提示还在。版本恢复改在抽屉里写「已恢复到该版本」。
- 天气走 Open-Meteo，无密钥。失败、离线、找不到地点都有文案，不编造温度。
- 「今天」仍用 `/explore`，只改可见标题。
- 日程冲突测试里的路线 `fetchedAt` 改成 `Date.now()`，避免 2026-11-04 的样本在一周后被算成过期。

## 包体积

审计基线：单个 JS 1010KB，gzip 312KB。

当前树最近一次生产构建（详情和起草已回到首包）首屏 modulepreload：

| 文件 | 原始 | gzip |
| --- | ---: | ---: |
| `index-B4SdUSVD.js` | 585242 | 178229 |
| `repository-DMd02cEX.js` | 395871 | 125256 |
| `jsx-runtime-CkXRJ162.js` | 8243 | 3154 |
| `preload-helper-BLdHbfdN.js` | 1519 | 827 |
| `rolldown-runtime-WkwZ5CU-.js` | 599 | 397 |
| 合计 | 991474 | 307863 |

CSS `index-xnjb4XAk.css` 61652 字节。文件名会随下次构建变化。Vite 仍警告有超过 500KB 的块，就是这个 `index`。

中间有一次构建把详情和起草也拆出去，首屏大约 934KB / gzip 298KB，但离线打不开详情，所以改了回来。那组数字不要当成当前树。

地图画布约 2.7KB，助手约 11KB，预算约 10KB，攻略约 7KB，仍是单独块。

## 接着做

```bash
git fetch origin cursor/ux-pass-1f8b
git checkout cursor/ux-pass-1f8b
npm ci
npx playwright install --with-deps chromium webkit
```

1. 在 `e2e/stage12-a11y.spec.ts` 量完「解锁白川庵」之后、点「助手」之前，点「关闭」。同样检查 `stage12-flows` 的助手测例会不会被同一个抽屉挡住。
2. `npx playwright test`。先看 `stage12-a11y`、`stage12-flows`、`stage12-iphone`、`stage11-offline`、`stage08-map`、`persistence`、`screenshots`、`ux-pass`。
3. 全绿后再 `npm run lint && npm run typecheck && npm run test && npm run build`，记下新的首屏体积。补 `docs/ux-pass/ACCEPTANCE.md` 和截图。Lighthouse 与生产冒烟留到合并之后。
4. 不要在这一轮直接推 `main`。合并和部署等接手的人确认 Playwright 全绿。
