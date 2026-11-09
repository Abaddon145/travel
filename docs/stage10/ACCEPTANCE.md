# 阶段 10 验收

预算按整数分记账。预计、实际、分类、按天和整趟合计都在同一币种里完成，不同币种不加在一起。住宿、车次、预订、清单、收藏和备注写在 IndexedDB，删掉整趟行程时一起撤销恢复。助手的行程快照不包含这些记录。

## 测试

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run test` | 36 个文件、110 个测试通过 |
| `npm run build` | 通过 |
| `npx playwright test e2e/stage10-tools.spec.ts` | 通过。京都示例合计为 ¥4,565.00 / ¥3,929.00 |
| `npx playwright test e2e/stage09-assistant.spec.ts` | 通过。锁定项仍不会被写入，修改仍可撤销 |

截图在 `docs/stage10/screenshots/`：`iphone-budget.png`（合计与分类柱）、`iphone-entries.png`（明细）、`iphone-bookings.png`、`iphone-kit.png`、`iphone-notes.png`、`iphone-empty.png`、`desktop-budget.png`、`desktop-bookings.png`、`desktop-empty.png`。

本地生产构建由 Playwright 起在 `https://127.0.0.1:43128`。没有改线上门禁，也没有部署。

## Dexie

版本 7 只新增 `ledgerEntries`、`bookings`、`checklistItems`、`favorites`、`travelNotes`。没有 `upgrade()` 改写旧行。已有行程、路线和用量保留；新表在升级后是空的。首次建库才会写入京都示例。杭州示例保持空白。

## 仍要注意

- 阶段 09 的两条遗留没有动：锁定按钮的无障碍名称为空；助手对话只在面板打开时留着。
- `e2e/persistence.spec.ts` 里 `getByText("白川庵")` 会同时命中时间线标题和地图列表里的「白川庵 · 未核实」。这是阶段 08 之后的定位过严，行程本身仍能创建。部署工作流不跑端到端测试。
- 数字过渡在 `prefers-reduced-motion` 或省流时直接显示终值。柱形只做 `scaleX`，大约 0.4 秒。
