# 阶段 05 验收

本地数据库与行程管理已接上现有页面。行程、日期、景点、住宿、时间线顺序和版本都写在本机 IndexedDB（库名 `lvxu-travel`）。第一次打开会写入示例行程；之后刷新不会重写。

## 新增与修改的文件

新增：

- `src/db/database.ts`、`errors.ts`、`migrate.ts`、`persistence.ts`、`repository.ts`、`seed.ts`、`validation.ts`
- `src/db/migration.test.ts`、`repository.test.ts`、`validation.test.ts`
- `src/hooks/use-travel-data.ts`
- `src/providers/database-provider.tsx`
- `src/components/confirm-dialog.tsx`、`database-status.tsx`、`day-form-drawer.tsx`、`form-drawer.tsx`、`item-form-drawer.tsx`、`text-field.tsx`、`timeline-editor.tsx`、`travel-error-boundary.tsx`、`trip-form-drawer.tsx`、`version-drawer.tsx`
- `src/components/ui/` 下的抽屉、对话框、表单、提示等组件
- `src/lib/feedback.ts`
- `e2e/persistence.spec.ts`、`e2e/screenshots.spec.ts`
- `playwright.config.ts`
- `docs/stage05/PLAN.md`、`docs/stage05/ACCEPTANCE.md`

修改：

- `src/domain/types.ts`：补上快照和版本类型
- `src/pages/trips-page.tsx`、`trip-detail-page.tsx`、`profile-page.tsx`：改为 Dexie 实时查询和编辑
- `src/components/trip-timeline.tsx`、`providers/app-providers.tsx`、`test/setup.ts`、`app-shell.test.tsx`、`trips-page.test.tsx`
- `package.json`、`package-lock.json`、`README.md`、`ROADMAP.md`

## 测试结果

命令均在仓库根目录执行，退出码为 0。

| 命令 | 结果 |
| --- | --- |
| `npx eslint .` | 通过，无报错 |
| `npx tsc -b --pretty false` | 通过 |
| `npm run test` | 8 个文件、18 个测试通过。覆盖创建与修改、重复日期、排序、锁定后禁止编辑/移动/删除、解锁后可删、版本快照与恢复、损坏记录读出失败、v1 扁平行程迁移到天/景点/住宿、表单校验、空列表、锁定按钮、错误与 IndexedDB 不可用界面 |
| `npm run build` | 通过。生成 `dist/sw.js`，导航回退到 `/index.html`。主包约 894 kB（gzip 约 280 kB），构建有体积提示 |
| `npm run test:e2e` | 3 个测试通过。创建行程、一天、景点与住宿后刷新仍在；锁定后编辑、上移、下移、删除按钮不可用；上移两次后刷新顺序不变；把标题改回「京都测试」的版本可以恢复 |

`npm run test` 摘要：`Test Files  8 passed (8)`，`Tests  18 passed (18)`。

`npm run test:e2e` 摘要：`3 passed`。其中包括 `创建的行程在刷新后仍在，锁定、排序和恢复版本可用`。

## 截图

视口 390×844，设备像素比 1。文件在本机产物目录，不进仓库。

- `/opt/cursor/artifacts/screenshots/trip-list.png` 行程列表
- `/opt/cursor/artifacts/screenshots/trip-detail.png` 行程时间线
- `/opt/cursor/artifacts/screenshots/edit-sheet.png` 编辑行程抽屉
- `/opt/cursor/artifacts/screenshots/locked-item.png` 已锁定的清水寺
- `/opt/cursor/artifacts/screenshots/version-history.png` 版本记录
- `/opt/cursor/artifacts/screenshots/empty-state.png` 空列表
- `/opt/cursor/artifacts/screenshots/error-state.png` IndexedDB 不可用，带重试

## 验收清单

| 项 | 结果 |
| --- | --- |
| 旅行数据重启后保留 | 通过。端到端测试刷新后标题、景点和住宿仍在 |
| 编辑与锁定正常 | 通过。锁定项不能编辑、移动、删除；解锁后可以删除。界面有「已锁定」标记 |
| 排序在刷新后保留 | 通过。上移后的顺序在重新加载后不变 |
| 恢复版本 | 通过。恢复「修改行程之前」后标题回到修改前 |
| 首次运行才播种示例数据 | 通过。`populate` 只在建库时运行；删光行程后不会自动补回 |
| v1 → v2 迁移 | 通过。旧的 `name` 和扁平行程会拆成日期、景点、住宿和时间线，随后丢掉 `itinerary` |
| 写入和读出都校验 | 通过。Zod 挡下空标题和颠倒的日期；损坏记录不会被静默丢掉 |
| 加载、空、错误、保存中、成功 | 通过。骨架屏、空状态、错误重试、保存按钮里的等待、成功提示和删除撤销都有 |
| IndexedDB 不可用 | 通过。有单独说明和重试 |
| 存储配额不足 | 代码会转成中文提示。这次没有在浏览器里人为撑满配额，未做端到端复现 |
| 请求持久化存储 | 通过。启动时调用 `navigator.storage.persist()`，「我的」里可以再请求一次 |
| 不破坏原有页面 | 通过。底部导航、探索占位、外观切换仍在；读取改为实时查询 |

## 留到后面的事

- 06 Cloudflare Worker 与 Access、07 DeepSeek、08 高德、09 交通编排、10 对话调整、11 同步、12 部署都还没做，仓库里也没有这些密钥。
- 排序用上移 / 下移和方向键，没有自由拖拽。
- 主包偏大，构建会提示超过 500 kB。拆包留到打磨阶段。
- 本地 HTTPS 使用临时自签证书，浏览器第一次会提示不受信任。
- 版本列表只有文字标签，没有逐项差异。
- 配额耗尽只做了错误映射，没有在真机上把磁盘写满。
