# 体验修订计划

依据 `uploads/AUDIT.md`（main `a0fcb2d`，iPhone 390×844）。建议只作方向，实现以现有数据模型和测试约束为准。

已对照的实现与文档：

- 详情、时间线、首页、探索、抽屉、用量、离线横幅、预算色、Worker 静态资源。
- [Workers 静态资源响应头](https://developers.cloudflare.com/workers/static-assets/headers/)：默认 `Cache-Control: public, max-age=0, must-revalidate`；带指纹的资源用 `_headers` 覆盖为一年 `immutable`。更具体的路径规则追加头，不改 `/api` 上已有的缓存。
- Motion：应用已用 `MotionConfig reducedMotion="user"` 与 `useReducedMotion()`。新过渡继续走这条，时长约 0.15s，不做 `mode="wait"` 的进出串联。
- React Router 的 `ScrollRestoration` 只恢复窗口滚动。要让 iOS 点状态栏回顶，滚动必须发生在文档上，而不是内部 `overflow` 容器。

配额 30 次 / 10 万令牌、锁定、撤销、高德“没有结果就不估距离”都不改语义。

## P0

1. 收起的地图只留一行摘要。核实控件只出现在展开后、且只针对选中的那一项。
   - `src/components/map-panel.tsx`
   - `src/pages/trip-detail-page.tsx`（把 `days` 传进去，不再 `flatMap`）
2. 地图列表按天分组、当天从 1 编号、路段只连当天相邻项。标记按天配色。
   - `src/components/map-panel.tsx`
   - `src/components/amap-canvas.tsx`
   - `src/lib/day-palette.ts`
3. 私人密钥验证成功后使 `ai-usage-remote` 与 `api-status` 失效并重取。`readServerUsage` 在 401 时返回 `null`，会被当成成功结果缓存。
   - `src/components/owner-key-form.tsx`（从 `owner-key-section.tsx` 抽出）
   - `src/components/usage-stats.tsx`
4. 离线提示放进粘性页头，单独占顶部安全区，文案改为「离线中 · 行程可查看」。在线时页头自己留安全区，避免叠两层。
   - `src/components/page-header.tsx`
   - `src/components/offline-banner.tsx`
   - `src/components/app-shell.tsx`

## P1

5. 时间线默认只读。点项目打开操作抽屉（上移、下移、锁定、编辑、删除，作为手势的按钮替代）。左滑打开同一个删除确认，长按后拖动排序。时段锁定放进「编辑这一天」。排序和锁定不再弹成功提示。
   - `src/components/trip-timeline.tsx`
   - `src/components/timeline-editor.tsx`
   - `src/components/day-form-drawer.tsx`
   - `src/lib/gestures.ts`
   - `src/lib/haptics.ts`
6. 外壳改为文档滚动，底部标签固定。`ScrollRestoration` 按历史记录恢复位置，系统点状态栏可以回顶。
   - `src/components/app-shell.tsx`
   - `src/components/tab-bar.tsx`
   - `src/components/update-prompt.tsx`（固定在标签栏上方）
   - `src/index.css`（独立窗口不再把壳锁死成 `height: 100dvh`）
7. 页面过渡改为同时淡入，约 0.15s，不再 `mode="wait"`。
   - `src/components/page-transition.tsx`
8. 「探索」改为「今天」：最近一趟进行中或即将出发的行程、下一站、倒计时，以及 Open-Meteo 天气（加载、失败、离线）。路由仍是 `/explore`，避免旧链接断开。
   - `src/pages/explore-page.tsx`
   - `src/components/tab-bar.tsx`
   - `src/lib/trip-phase.ts`
   - `src/lib/weather.ts`
   - `shared/security-headers.ts`（`connect-src` 增加 Open-Meteo）
9. 首页按即将出发 / 进行中 / 已结束分组，卡片有倒计时或第几天，以及由目的地稳定得出的封面色。删除放进「更多」，并保留左滑。
   - `src/pages/trips-page.tsx`
   - `src/lib/trip-phase.ts`
   - `src/lib/cover-color.ts`
   - `src/components/swipe-row.tsx`
10. 用户语言。用量主界面是「今日 n/30」进度条，令牌和美元放进折叠。起草页不写模型代号。我的页不写 IndexedDB 和图标像素。
    - `src/components/usage-stats.tsx`
    - `src/components/plan-screen.tsx`
    - `src/pages/profile-page.tsx`
    - `src/components/install-section.tsx`
11. 「保存并验证」一步完成。起草失败、地图未授权、助手未授权时就地出现同一张表单。
    - `src/components/owner-key-form.tsx`
    - `src/components/owner-key-section.tsx`
    - `src/components/plan-screen.tsx`
    - `src/components/map-panel.tsx`
    - `src/components/assistant-sheet.tsx`
12. 抽屉高度跟随 `visualViewport`，不超过可见区域。表单的保存 / 取消固定在抽屉顶部，聚焦时把字段滚进视野。
    - `src/hooks/use-visual-viewport.ts`
    - `src/components/ui/drawer.tsx`
    - `src/components/form-drawer.tsx`
    - `index.html`（`interactive-widget=resizes-content`）
13. 展开的地图吸在页头下方、大约半屏。选中项有底色，标记跳动（减少动态效果时不跳）。展开状态记在 `sessionStorage`。刷新后重画已选路线并框选全部点。
    - `src/components/map-panel.tsx`
    - `src/components/amap-canvas.tsx`
    - `src/components/page-header.tsx`（写出 `--page-header-height`）
    - `src/index.css`
14. 路由级 `lazy()`：起草、行程详情、预算、预订、清单、攻略。地图画布和助手在真正打开时再加载。zod 仍留在壳里，因为首页读行程就要做本地校验；`zod/mini` 的调用方式和现有 `safeParse` 链不一致，换掉会动到每一层校验，不在这次拆包里做。
    - `src/router.tsx`
    - `src/pages/trip-detail-page.tsx`
    - `src/components/map-panel.tsx`

## P2

- 提示只保留可撤销的，以及用户刚刚提交的保存结果。排序、锁定、版本恢复不弹。恢复结果写在抽屉里。Toaster 下移安全区。
  - `src/lib/feedback.ts`（撤销提示保留）
  - `src/components/timeline-editor.tsx`
  - `src/components/version-drawer.tsx`
  - `src/components/ui/sonner.tsx`
- 预算「实际」仅在超出预计时用朱砂。
  - `src/domain/money.ts`（`isOverBudget`）
  - `src/pages/budget-page.tsx`
  - `src/components/budget-chart.tsx`
- 版本记录的关闭放进标题行。每一行和确认框都先给出天数与项目名，再覆盖。
  - `src/components/version-drawer.tsx`
- 返回仍是链接（地址是退路）。历史栈里有上一页时 `navigate(-1)`。
  - `src/components/page-header.tsx`
- 网页按钮按下略缩小（尊重减少动态效果）。Capacitor 壳上用 `@capacitor/haptics` 轻触，网页不调用。
  - `src/components/ui/button.tsx`
  - `src/lib/haptics.ts`
  - `package.json`
  - `ios/App/CapApp-SPM/Package.swift`（`cap sync` 能改则改）
- 404 和找不到行程用同一块空状态：图标、说明、回列表。
  - `src/components/missing-state.tsx`
  - `src/pages/not-found-page.tsx`
  - `src/pages/trip-detail-page.tsx`
  - `src/components/trip-tools-frame.tsx`
  - `src/pages/guide-page.tsx`（「返回日程」至少 44px）
- 起草：兴趣改为标签；目的地给出本地联想，不请求高德。
  - `src/components/plan-screen.tsx`
  - `src/components/text-field.tsx`（焦点回调）
  - `src/lib/destinations.ts`
- 助手对话写入 `sessionStorage`（按行程，不含密钥）。`revise` 的用量计入本机 `aiUsage`。
  - `src/lib/assistant-session.ts`
  - `src/components/assistant-sheet.tsx`
- `/assets/*` 一年 immutable。`index.html`、`sw.js`、manifest 保持必须再验证。真正的 `public/robots.txt`（禁止抓取，这是私人行程本）。
  - `shared/security-headers.ts`
  - `public/_headers`
  - `public/robots.txt`

## 点击区域

- 时间线名称、地图列表项、攻略里的返回，都至少 44px。现有 `h-11` 按钮保持。

## 测试

- 改 `src/components/map-panel.test.tsx`、`owner-key-section.test.tsx`、`app-shell.test.tsx`、`trips-page.test.tsx`、`plan-screen.test.tsx`、`budget-page.test.tsx`、`vite.headers.test.ts`、`worker/security-headers.test.ts`。
- 新增行程阶段、手势阈值、天气、助手会话、用量刷新的单元测试。
- 调整 e2e：地图先展开再点选才出现核实；时间线先点项目才出现上移 / 锁定；密钥改为保存并验证；今天页标题；离线横幅仍用 `offline-banner`。
- 新增 `e2e/ux-pass.spec.ts`（模拟接口，390×844）。

## 不改

AI 起草、锁定与撤销、高德未核实不估距离、预算分币种、预订清单、备份、PWA 更新提示、配额常量。
