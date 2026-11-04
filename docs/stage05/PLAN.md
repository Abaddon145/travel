# 阶段 05 实现计划：本地数据库与行程管理

本计划对照已经完成的 01–04 代码，以及 Dexie 官方文档：

- 版本与 `upgrade`、`populate`、事务：[Design](https://dexie.org/docs/Tutorial/Design)
- [Version.upgrade()](https://dexie.org/docs/Version/Version.upgrade())
- [Dexie.transaction()](https://dexie.org/docs/Dexie/Dexie.transaction())
- [useLiveQuery()](https://dexie.org/docs/dexie-react-hooks/useLiveQuery())

Dexie 3+ 会按已安装的库和下一版声明做差量升级；带 `upgrade()` 的版本一旦发布就不能再改。全新安装直接落到最终结构，不跑 `upgrade()`，只跑 `populate`（只在第一次创建库时）。事务回调里只用 Dexie / 全局 Promise，避免中途 `await` 无关的异步 API，否则 IndexedDB 会提前提交。`useLiveQuery` 只观察通过 Dexie 发生的变更；加载中返回 `undefined`，空数组表示真的没有数据。查询里抛出的错误用错误边界接住。

## 现有代码怎么接

- `src/domain/types.ts` 已经有 `Trip`、`Day`、`Place`、`Lodging`、`TimelineItem` 和列表 / 详情视图。数据库沿用这些类型，并补上 `TripVersion` / `TripSnapshot`。
- `src/data/mock-trips.ts` 继续作为示例数据来源，不再被页面直接读取。第一次建库时由 `populate` 写入。
- `src/pages/trips-page.tsx`、`src/pages/trip-detail-page.tsx`、`src/components/trip-timeline.tsx` 改为观察 IndexedDB。探索页保持占位。
- `src/pages/profile-page.tsx` 增加持久化存储状态。文案从「只在内存里」改成「存在这台设备的 IndexedDB」。
- `src/providers/app-providers.tsx` 包上数据库闸门和 toast。TanStack Query 负责「是否已获得持久化存储」和写操作的保存中状态；列表和详情的读取走 `useLiveQuery`，不把整库放进 Query 缓存。

## 数据模型

库名 `lvxu-travel`。主键都是调用方生成的字符串，方便快照来回写。

| 版本 | 对象库 | 作用 |
| --- | --- | --- |
| v1 | `trips: id, updatedAt`；`itinerary: id, tripId, dayDate, order` | 旧的扁平行程。行程用 `name`，一天里的景点和住宿挤在 `itinerary` |
| v2 | 增加 `days`、`places`、`lodgings`、`timelineItems`、`versions` | `upgrade()` 把 `name` 改成 `title`，按 `tripId + dayDate` 拆出天，再拆出景点、住宿和时间线条目，`locked` 缺省为 false |
| v3 | `itinerary: null` | 拆完再删旧表。升级函数放在 v2，避免删表和读旧表撞在同一版本 |

最终索引：

- `days`: `id, tripId, date, [tripId+date]`
- `places` / `lodgings`: `id, tripId`
- `timelineItems`: `id, tripId, dayId, order, [dayId+order]`
- `versions`: `id, tripId, createdAt`

`versions.snapshot` 保存该次修改之前的整趟行程（行程、天、景点、住宿、时间线）。每个行程最多留 30 条，更早的删掉。

## 要新增的文件

- `src/db/errors.ts`：不可用、配额、校验失败、数据损坏、锁定、冲突、找不到。给界面稳定的中文消息。
- `src/db/validation.ts`：Zod schema。所有写入前解析；读出和恢复快照时再解析一遍。日期、时间 `HH:mm`、标题长度、结束日期不早于开始日期。
- `src/db/migrate.ts`：`migrateV1ToV2(tx)`。只在升级事务里读 `itinerary`、写新表。
- `src/db/seed.ts`：把 `mock-trips` 写进新库，并为每趟示例行程存一条「示例行程」版本。
- `src/db/database.ts`：`TravelDatabase`。声明 v1–v3，`populate` 时按构造参数决定是否播种（测试可关闭）。导出单例 `db` 和 `initDatabase()`。`initDatabase` 在没有 `indexedDB` 时失败，成功后调用 `navigator.storage.persist()`（失败不阻塞）。
- `src/db/repository.ts`：全部读写。多次写入放进 `db.transaction("rw", ...)`。有意义的修改先读出整图、执行修改、再把修改前的图存成版本。锁定条目不能改内容、不能交换顺序、不能删除；解锁本身允许。删除整趟行程时版本一起删掉，并把删除前的图返回给界面做撤销。恢复版本时先把当前图存成「恢复前的行程」，再整表替换该行程的天、景点、住宿和时间线，不动版本表。
- `src/db/persistence.ts`：`persist()` / `persisted()` 的薄封装。
- `src/providers/database-provider.tsx`：打开数据库。加载、失败、IndexedDB 不可用三种状态，失败可以重试。
- `src/components/database-status.tsx`：上述三态的界面。加载用 Skeleton，错误和不可用用 Alert，并提供重试。
- `src/components/confirm-dialog.tsx`：删除和恢复前的确认。
- `src/components/trip-form-drawer.tsx`：新建 / 编辑行程。Field + Input / Textarea，Zod 错误落到字段。
- `src/components/day-form-drawer.tsx`：新建 / 编辑某一天。
- `src/components/item-form-drawer.tsx`：新建 / 编辑景点或住宿。类型用 ToggleGroup。
- `src/components/version-drawer.tsx`：版本列表和恢复。
- `src/components/timeline-editor.tsx`：一天之内的时间线。上移 / 下移按钮（可聚焦，方向键同样可调顺序），锁定按钮，编辑和删除。锁定时后三项不可用，并显示「已锁定」。
- `src/hooks/use-travel-data.ts`：`useLiveQuery` 包一层校验过的列表、详情和版本。
- `src/db/*.test.ts`：CRUD、排序、锁定、版本快照与恢复、v1→v2 迁移、读写校验。用 `fake-indexeddb`。
- `e2e/persistence.spec.ts`：新建行程、一天、景点、住宿，刷新仍在；锁定后不能编辑 / 移动 / 删除；调整顺序后刷新仍在；恢复版本生效。
- `playwright.config.ts`：对 HTTPS 预览跑 Chromium，视口按 iPhone 390×844，忽略本地自签证书。
- `docs/stage05/ACCEPTANCE.md`：实现和验证之后再写。

## 要修改的文件

- `src/domain/types.ts`：补 `TripSnapshot`、`TripVersion`。
- `src/pages/trips-page.tsx`：去掉内存参数，改读 live query。空列表、骨架屏、新建按钮。
- `src/pages/trip-detail-page.tsx`：编辑、删除、加一天、版本入口；时间线交给 `timeline-editor`。
- `src/pages/profile-page.tsx`：持久化存储说明和请求按钮；更正数据保存的文案。
- `src/components/trip-timeline.tsx`：留给只读结构。交互放在 `timeline-editor`，避免模拟数据页面和编辑器缠在一起。若编辑器完全覆盖展示，这个文件改为被编辑器复用或删去重复标记。实现时二选一，不保留两套时间线视觉。
- `src/providers/app-providers.tsx`：挂上数据库闸门。Toaster 改读现有的外观 store，去掉对 `next-themes` 的依赖。
- `src/components/ui/sonner.tsx`：同上。
- `src/test/setup.ts`：在任何 Dexie 导入之前启用 `fake-indexeddb/auto`，并补上 `navigator.storage`。
- `package.json`：`dexie`、`dexie-react-hooks`、`zod`；开发依赖 `fake-indexeddb`、`@playwright/test`。脚本 `test:e2e`。
- `ROADMAP.md`：05 标成已完成。
- `README.md`：说明数据写在本机 IndexedDB，以及如何跑端到端测试。

## 行为细则

- 创建行程后立刻存一条「创建行程」版本。其余修改存的是改之前的整图，标签写明即将发生的动作。
- 删除行程、天、项目后用 toast 的「撤销」回到刚存下的版本；整趟行程被删掉时，撤销使用返回的快照重新插入。
- 和锁定项交换顺序是不允许的，按钮禁用。
- 同一行程里日期不能重复。
- 删除景点或住宿时，若仍被锁定的时间线条目引用，整次删除失败；没有别的条目引用时，连带删除实体。
- 配额不足、数据库打不开、记录解析失败都有单独文案，不把底层异常直接扔给用户。
- 不接入 Worker、DeepSeek、高德，不提交任何密钥。
