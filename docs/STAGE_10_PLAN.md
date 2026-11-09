# 阶段 10 实现计划：预算与旅行辅助工具

只做预算统计、住宿 / 车次 / 预订、清单 / 收藏 / 备注，以及克制的数字与图表过渡。不改门禁，不改 DeepSeek 限额，不修阶段 09 的两条遗留，不做阶段 11–12 的离线备份与上线收尾。阶段 08 的高德路线和阶段 09 的助手、锁定与撤销保持原样。

## 对照过的现状

- 路线图里的「预算」还不是账本。生成偏好 `budget: low | medium | high` 在 `shared/ai-schema.ts` 与 `src/components/plan-screen.tsx`。DeepSeek 费用在 `src/lib/ai-cost.ts`，用美元浮点估算令牌价格。旅行花费不能复用这套浮点。
- 行程库 `lvxu-travel` 当前到版本 6（`src/db/database.ts`）。版本 1–3 拆行程，4 加 `aiUsage`，5 加 `mapRoutes` 并把旧地点标成未核实，6 加 `routePicks`。`TripSnapshot` 只含行程、天、景点、住宿和时间线，助手撤销依赖它。
- 住宿时间线 `Lodging` 是日程上的停留点，不是确认号和车次。探索页仍是占位，没有预算页。
- 动效：根上 `MotionConfig reducedMotion="user"`（`src/App.tsx`）。各处用 `useReducedMotion()`，减少动态效果时 `duration: 0`、不做位移。缓动是 `[0.22, 1, 0.36, 1]`，大约 0.2 秒。测试里的 `matchMedia` 把减少动态效果视为匹配。
- 界面：暖纸色、朱砂强调、系统字体、8px 节奏、`max-w-lg`、底部三标签。表单用抽屉、`TextField`、Zod 字段错误。空用 `Empty`，加载用 `Skeleton`，失败用 `Alert` 或错误边界。

## 官方文档里要守住的点

Dexie [Design](https://dexie.org/docs/Tutorial/Design) 与 [Version.upgrade()](https://dexie.org/docs/Version/Version.upgrade())：

- Dexie 3 按已安装的库和下一版声明做差量升级。新版本只写有变化的表。没写进新版本的表不会被删。
- 带 `upgrade()` 的版本一旦发布就不能改。本阶段只加空表，不改旧行，所以版本 7 不挂 `upgrade()`。全新安装直接落到最终结构，不跑升级函数，只跑 `populate`。已有用户升级时 `populate` 不会再跑，示例账本不会灌进旧库。
- 升级函数抛错会整段回滚。这里没有数据改写，旧行程、路线和用量不会被碰到。
- 事务里只做 IndexedDB 操作。`useLiveQuery` 加载中是 `undefined`，空数组才是真的没有数据。

Motion for React（项目为 `motion` 12，从 `motion/react` 引入）：

- 根配置已经是 `reducedMotion="user"`，会关掉变换和布局动画，保留透明度和颜色。
- 数字变化用 `animate(from, to, { onUpdate })` 写到 DOM 文本，不在渲染里读 MotionValue，不每帧 `setState`。
- 柱形用 `transform: scaleX()`，宽度只设一次。不动画 `width` / `height`。
- 时长约 0.45 秒，沿用现有缓动，不用回弹。减少动态效果，或 `navigator.connection.saveData`，都直接落到终值。这是现有「时长为 0」降级的同一条规则，另外接上省流。
- 不引入 Motion+ 的 `AnimateNumber`。

## 金额

旅行金额用整数最小单位，不用二进制浮点。

| 币种 | 代码 | 小数位 | 显示 |
| --- | --- | --- | --- |
| 人民币 | CNY | 2 | ¥1,234.50 |
| 美元 | USD | 2 | $1,234.50 |
| 日元 | JPY | 0 | JP¥1,234 |
| 欧元 | EUR | 2 | €1,234.50 |
| 港币 | HKD | 2 | HK$1,234.50 |
| 新台币 | TWD | 2 | NT$1,234.50 |
| 韩元 | KRW | 0 | ₩1,234 |

默认人民币。解析走字符串拆分：`19.99` 是 `1999` 分，`0.10 + 0.20` 合计 `30` 分。不使用 `* 100` 的浮点乘法。单笔上限 `100_000_000_000`（人民币一百亿元）。合计若不是安全整数就抛错，不显示一个近似值。

币种与现有模型的关系：每条账和 DeepSeek 用量一样自带币种 / 模型字段，不做汇率换算。`formatUsd` 仍只服务令牌费用。不同币种的旅行花费分桶合计，永远不加在一起。

一条账：

- `plannedMinor`：预计，整数，可以为 0。
- `actualMinor`：`null` 表示还没记实际；`0` 是记过的零，和 `null` 不同。
- `date`：空字符串表示不归到某一天。有值则是 `YYYY-MM-DD`，不强制落在行程日期内（订金可以早于出发）。
- `category`：住宿、交通、餐饮、门票、购物、其他。

合计口径（测试按这个锁死）：

- 预计 = 全部 `plannedMinor`。
- 实际 = 非 `null` 的 `actualMinor`。
- 差额 = 实际 − 预计（未记实际按 0 参与这对大数）。
- 已记差额 = 只统计写了实际的条目。
- 未记 = 实际为 `null` 的预计之和。
- 分类、按天都在同一币种内。空分类不出现。天按日期升序，未分日期的放在最后。

## 预订、清单、收藏、备注

都挂 `tripId`。预订另有日期，住宿可有退房日。

| 种类 | 字段 |
| --- | --- |
| 住宿 | 名称、入住、退房、确认号、地址、备注 |
| 车次 | 车次、日期、席位、区间、备注 |
| 预订 | 名称、日期、单号、说明、备注 |

清单有完成状态和顺序。收藏是标题加备注。备注是标题、正文，日期可空。这些记录不进 `TripSnapshot`，助手撤销不会改动它们。

删除整趟行程时，在同一个事务里删掉该行程的账、预订、清单、收藏和备注，并把它们和行程快照一起交给撤销。恢复时写回。只恢复行程、不恢复这些记录，会造成删了就找不回。

## 数据库版本 7

```
ledgerEntries: id, tripId, date, category, [tripId+date]
bookings: id, tripId, date, kind, [tripId+kind]
checklistItems: id, tripId, order
favorites: id, tripId, createdAt
travelNotes: id, tripId, updatedAt
```

不改版本 1–6 的声明。不改 `trips`、`days`、`places`、`lodgings`、`timelineItems`、`versions`、`aiUsage`、`mapRoutes`、`routePicks` 的索引和字段。

示例数据只在首次建库时写入京都行程：六笔人民币账、一条住宿、一条车次、一条预订、三条清单、两条收藏、一条备注。杭州留空，用来看空状态。

## 界面

行程详情的页头下加一行分区：日程、预算、预订、清单。路由：

- `/trips/:tripId` 日程，现有地图、时间线和助手不动
- `/trips/:tripId/budget`
- `/trips/:tripId/bookings`
- `/trips/:tripId/kit`

预算页：两个大数字（预计、实际）、一句可对账的差额、分类柱、按天列表、账目列表。柱和两个大数字有过渡；分类里的小数字和按天列表不逐个跳动。多币种时先看人民币，再用文字切换，不画在同一根柱上。

预订页按住宿、车次、预订分组。清单页是三节：清单（可勾选）、收藏、备注。

状态：

- 加载：`Skeleton`，并有「正在读取」的无障碍文本。
- 空：`Empty`，说明该写什么。
- 错误：合计溢出或数据损坏时用 `Alert`；查询抛错仍进现有错误边界。
- 校验：抽屉里 Zod 与金额解析的中文错误落在字段上。保存失败用现有 toast。

视觉沿用现有令牌。朱砂只给实际金额和当前柱。不用新的图表库，不加第四个底部标签。

## 要新增的文件

- `src/domain/money.ts`：币种、解析、格式化、分类 / 按天 / 整趟合计、差额说明。
- `src/domain/money.test.ts`：合计、分类、实际与预计、`null` 与 0、多币种、小数进位、上限、负数、非安全整数。
- `src/db/tool-validation.ts`：账、预订、清单、收藏、备注的 Zod。
- `src/db/tools.ts`：增删改查和按行程读出。写入前确认行程还在。
- `src/db/tools.test.ts`：写入后关掉再打开仍在；删除行程后撤销能回到原账和清单。
- `src/hooks/use-trip-tools.ts`：`useLiveQuery`。
- `src/hooks/use-quiet-motion.ts`：减少动态效果或省流时不做数字和柱的过渡。
- `src/components/trip-section-nav.tsx`
- `src/components/trip-tools-frame.tsx`：加载、找不到行程、页头。
- `src/components/select-field.tsx`
- `src/components/money-figure.tsx`
- `src/components/budget-chart.tsx`
- `src/components/ledger-form-drawer.tsx`
- `src/components/booking-form-drawer.tsx`
- `src/components/kit-form-drawer.tsx`
- `src/pages/budget-page.tsx`
- `src/pages/bookings-page.tsx`
- `src/pages/kit-page.tsx`
- `src/pages/budget-page.test.tsx`：空状态、合计数字、校验错误。
- `e2e/stage10-tools.spec.ts`：iPhone 与桌面截图。
- `docs/stage10/ACCEPTANCE.md`：验证之后再写。

## 要修改的文件

- `src/domain/types.ts`：新记录类型。不改 `Trip` 与 `TripSnapshot` 的字段。
- `src/db/database.ts`：版本 7 只声明新表。
- `src/db/migration.test.ts`：版本 6 的行程和路线选择升级后还在，新表为空。
- `src/db/repository.ts`：`deleteTrip` / `restoreDeletedTrip` 带上工具记录。返回 `{ snapshot, tools }`。旧的纯快照仍可恢复，只是没有工具记录。
- `src/db/seed.ts`：首次建库写入京都示例。
- `src/pages/trips-page.tsx`、`src/pages/trip-detail-page.tsx`：删除撤销改走新的返回值。详情页加上分区导航。
- `src/components/page-header.tsx`：可选的页头底部，用来放分区导航。
- `src/components/text-field.tsx`：金额需要 `inputMode` 和占位符。
- `src/router.tsx`：三条新路由。
- `ROADMAP.md`：09 标成已完成，10 改成这一阶段。
- `README.md`：补一句账本在本机。

## 明确不做

- 不改 `AUTH_MODE`、Access、额度（每天 30 次、10 万令牌）。
- 不把任何密钥写进仓库。
- 不把预算写进助手快照，也不让助手改预算。
- 不修锁定按钮的无障碍名称，不把助手对话持久化。
- 不做导出、云备份、冲突合并和上线清单。
