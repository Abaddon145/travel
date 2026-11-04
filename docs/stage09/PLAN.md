# 阶段 09 实现计划：AI 助手与局部重规划

只做行程内的助手、锁定约束、差异确认和撤销。不开始阶段 10。距离仍只来自已核实的高德路线。

查阅：

- DeepSeek Chat Completions 继续用现有 `completeJson`：`response_format: { type: "json_object" }`，提示里含 json 和示例，`thinking: { type: "disabled" }`。额度仍是 `AiUsageLedger`，每天 30 次、10 万令牌。
- Dexie 不新开表。日期上增加可选的 `locked`、`lockedFrom`、`lockedTo`，zod 默认值让旧行程仍能打开。撤销继续用已有的 `versions`。
- Motion 只做短淡入，并尊重 `prefers-reduced-motion`。抽屉本身已有过渡。

## 行为

助手在行程详情里打开。上下文是当前行程的日期、项目和锁定状态。快捷指令：节奏放慢、替换这个地点、雨天备选、压缩到半天、提前结束。范围是选中的一天；若时间线上有选中项目，一并传给模型。最近几轮对话留在这次打开里。

模型只返回 json：`message` 和 `ops`（add / remove / move / update）。服务端用 zod 校验。提示里写明不能改锁定内容。服务端和客户端都用同一套 `splitLockedOps`：锁定项目、锁定的全天、落在锁定时段里的项目从补丁里剔除。若补丁全都碰锁，返回 `locked_violation`，没有可应用的操作。应用前再查一次；只要还碰到锁，事务回滚，不写版本。

时间冲突在本地计算。按当天顺序比较已填写的时间。后一项更早，是排序冲突。间隔短于已核实路线的分钟数，是来不及。没有已核实路线时只标「未核实」，不写估算分钟。

差异按天列出，可勾选部分操作，冲突标在下面。确认后写入，并留下「助手修改之前」。撤销恢复该版本，并留下当前内容作为重做。放弃预览不写库。失败、额度用尽、校验失败时行程保持原样，并给出错误状态。

## 文件

- `shared/revise-schema.ts`：请求、补丁、锁定剔除。
- `worker/ai/revise.ts`：组提示、调用 `completeJson`、剔除锁定操作。
- `worker/ai/http.ts`：`POST /api/ai/revise`，同一额度账本。正文上限单独放到 48KB。
- `src/lib/schedule-conflicts.ts`：冲突。
- `src/lib/assistant-client.ts`：带私人密钥的请求。
- `src/db/repository.ts`：`setDayLock`、`applyAssistantPatch`。`restoreVersion` 返回重做用的版本号。
- `src/db/validation.ts`、`src/domain/types.ts`：日期锁定字段。
- `src/components/assistant-sheet.tsx`：空、加载、错误、额度、差异、冲突、锁定说明、确认、撤销。
- `src/components/timeline-editor.tsx`、`src/components/trip-timeline.tsx`：锁定全天和锁定时段。
- `src/pages/trip-detail-page.tsx`：入口。
- `e2e/stage09-assistant.spec.ts`：锁定不被改、差异、撤销。模型在浏览器里模拟。
