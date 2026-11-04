# 阶段 09 验收

助手只提出调整。锁定的项目、锁定的全天和锁定时段不会被写入。确认后才改行程，并且可以撤销。

## 测试

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run test` | 33 个文件、96 个测试通过 |
| `npm run build` | 通过 |
| `npx playwright test e2e/stage09-assistant.spec.ts` | 通过。锁定的白川庵被忽略，三年坂的备注写入后可以撤销 |

截图在 `docs/stage09/screenshots/`：`empty.png`、`diff.png`、`applied.png`、`undone.png`。

## 仍要注意

这次打开助手期间的对话不会在刷新后保留。已经应用的修改记在版本里，刷新后仍可从版本记录恢复。每日额度记在 Worker 账本上，默认 30 次、10 万令牌。
