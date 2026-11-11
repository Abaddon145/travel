import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, useReducedMotion } from "motion/react";
import type { PatchOp } from "@shared/revise-schema";
import { OwnerKeyForm } from "@/components/owner-key-form";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { recordAiUsage } from "@/db/ai-usage";
import { db } from "@/db/database";
import { applyAssistantPatch, readMapRoutes, restoreVersion } from "@/db/repository";
import { readAssistantSession, writeAssistantSession } from "@/lib/assistant-session";
import type { TripDetail } from "@/domain/types";
import { requestRevision } from "@/lib/assistant-client";
import { useOnline } from "@/lib/online";
import { findScheduleConflicts } from "@/lib/schedule-conflicts";

const chips = [
  { label: "节奏放慢", instruction: "把这一天的节奏放慢，减少安排，把时间拉开。" },
  { label: "替换这个地点", instruction: "替换当前选中的地点，换成更合适的一处。" },
  { label: "雨天备选", instruction: "给这一天准备雨天备选，把户外安排改成室内。" },
  { label: "压缩到半天", instruction: "把这一天压缩到半天，只保留最重要的安排。" },
  { label: "提前结束", instruction: "提前结束这一天，去掉傍晚之后未锁定的安排。" },
];

type Turn = { role: "user" | "assistant"; text: string };
type PreviewItem = { id: string; name: string; order: number; timeLabel: string };

function itemName(detail: TripDetail, itemId: string) {
  return (
    detail.days.flatMap((day) => day.items).find((item) => item.id === itemId)?.name ??
    "项目"
  );
}

function dayIdFor(detail: TripDetail, op: PatchOp) {
  if (op.op === "add" || op.op === "move") return op.dayId;
  return (
    detail.days.find((day) => day.items.some((item) => item.id === op.itemId))?.id ?? ""
  );
}

function describeOp(detail: TripDetail, op: PatchOp) {
  if (op.op === "add") return `增加 ${op.name}`;
  if (op.op === "remove") return `删除 ${itemName(detail, op.itemId)}`;
  if (op.op === "move") return `移动 ${itemName(detail, op.itemId)}`;
  const changes = [
    op.timeLabel ? `时间 ${op.timeLabel}` : "",
    op.note ? op.note : "",
    op.name ? op.name : "",
  ]
    .filter(Boolean)
    .join("，");
  return `修改 ${itemName(detail, op.itemId)}${changes ? `：${changes}` : ""}`;
}

function previewDays(detail: TripDetail, ops: PatchOp[]) {
  const days = detail.days.map((day) => ({
    id: day.id,
    items: day.items.map((item): PreviewItem => ({
      id: item.id,
      name: item.name,
      order: item.order,
      timeLabel: item.timeLabel,
    })),
  }));
  for (const op of ops) {
    if (op.op === "remove") {
      for (const day of days)
        day.items = day.items.filter((item) => item.id !== op.itemId);
    } else if (op.op === "update") {
      for (const day of days) {
        day.items = day.items.map((item) =>
          item.id === op.itemId
            ? {
                ...item,
                timeLabel: op.timeLabel ?? item.timeLabel,
                name: op.name ?? item.name,
              }
            : item,
        );
      }
    } else if (op.op === "move") {
      const source = days.find((day) => day.items.some((item) => item.id === op.itemId));
      const item = source?.items.find((entry) => entry.id === op.itemId);
      if (!source || !item) continue;
      source.items = source.items.filter((entry) => entry.id !== op.itemId);
      days.find((day) => day.id === op.dayId)?.items.push({ ...item, order: op.order });
    } else {
      days
        .find((day) => day.id === op.dayId)
        ?.items.push({
          id: `new-${op.name}`,
          name: op.name,
          order: op.order,
          timeLabel: op.timeLabel,
        });
    }
  }
  return days;
}

export function AssistantSheet({
  open,
  onOpenChange,
  detail,
  selectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: TripDetail;
  selectedId: string | null;
}) {
  const reduce = useReducedMotion();
  const online = useOnline();
  const queryClient = useQueryClient();
  const routes = useLiveQuery(() => readMapRoutes(db, detail.id), [detail.id]) ?? [];
  const stored = readAssistantSession(detail.id);
  const [dayId, setDayId] = useState(stored.dayId || detail.days[0]?.id || "");
  const [instruction, setInstruction] = useState(stored.instruction);
  const [history, setHistory] = useState<Turn[]>(stored.history);
  const [needsKey, setNeedsKey] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "loading" | "error" | "preview" | "applied"
  >("idle");
  const [status, setStatus] = useState("");
  const [ops, setOps] = useState<PatchOp[]>([]);
  const [rejected, setRejected] = useState<PatchOp[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [redoId, setRedoId] = useState<string | null>(null);

  const activeDay = detail.days.some((day) => day.id === dayId)
    ? dayId
    : (detail.days[0]?.id ?? "");

  useEffect(() => {
    writeAssistantSession(detail.id, { history, instruction, dayId: activeDay });
  }, [detail.id, history, instruction, activeDay]);
  const chosen = ops.filter((_, index) => checked[index]);
  const conflicts = findScheduleConflicts(previewDays(detail, chosen), routes).filter(
    (conflict) => chosen.some((op) => dayIdFor(detail, op) === conflict.dayId),
  );

  async function send(text: string) {
    const instructionText = text.trim();
    if (!instructionText) return;
    if (!online) {
      setPhase("error");
      setStatus("助手需要网络。当前日程不会被修改。");
      return;
    }
    setPhase("loading");
    setStatus("");
    setOps([]);
    setRejected([]);
    const result = await requestRevision({
      instruction: instructionText,
      scope: { dayId: activeDay, itemIds: selectedId ? [selectedId] : [] },
      history,
      trip: {
        title: detail.title,
        destination: detail.destination,
        days: detail.days.map((day) => ({
          id: day.id,
          title: day.title,
          date: day.date,
          locked: day.locked === true,
          lockedFrom: day.lockedFrom ?? "",
          lockedTo: day.lockedTo ?? "",
          items: day.items.map((item) => ({
            id: item.id,
            name: item.name,
            area: item.area,
            note: item.note,
            timeLabel: item.timeLabel,
            locked: item.locked,
            order: item.order,
            kind: item.kind,
          })),
        })),
      },
    });
    setHistory((current) =>
      [...current, { role: "user" as const, text: instructionText }].slice(-8),
    );
    if (!result.ok) {
      setPhase("error");
      setStatus(result.message);
      setNeedsKey(result.error === "unauthorized");
      return;
    }
    setNeedsKey(false);
    try {
      await recordAiUsage(db, {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        destination: detail.destination,
        ...result.usage,
      });
      await queryClient.invalidateQueries({ queryKey: ["ai-usage"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-usage-remote"] });
    } catch {
      // The suggestion can still be reviewed if the local usage row is rejected.
    }
    setHistory((current) =>
      [...current, { role: "assistant" as const, text: result.message }].slice(-8),
    );
    setOps(result.ops);
    setRejected(result.rejected);
    setChecked(result.ops.map(() => true));
    setStatus(result.message);
    setPhase(result.ops.length > 0 ? "preview" : "idle");
    setInstruction("");
  }

  async function apply() {
    if (chosen.length === 0) return;
    try {
      const versionId = await applyAssistantPatch(db, detail.id, chosen);
      setUndoId(versionId);
      setRedoId(null);
      setPhase("applied");
      setStatus("已写入行程。");
    } catch {
      setPhase("error");
      setStatus("没有写入。锁定内容或校验没有通过，行程保持原样。");
    }
  }

  async function undo() {
    if (!undoId) return;
    const next = await restoreVersion(db, undoId);
    setRedoId(next);
    setUndoId(null);
    setStatus("已撤销这次调整。");
  }

  async function redo() {
    if (!redoId) return;
    const next = await restoreVersion(db, redoId);
    setUndoId(next);
    setRedoId(null);
    setStatus("已恢复这次调整。");
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-safe">
        <div className="flex items-center gap-2 px-4 pt-2">
          <DrawerTitle className="min-w-0 flex-1">助手</DrawerTitle>
          <Button type="button" variant="ghost" className="h-11" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
        <DrawerDescription className="px-4 pt-2">锁定的项目不会被改动。确认后才写入。</DrawerDescription>
        <form
          className="flex gap-2 px-4 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(instruction);
          }}
        >
          <input
            className="h-11 min-h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={instruction}
            placeholder="想怎么调整"
            aria-label="调整说明"
            onChange={(event) => setInstruction(event.target.value)}
          />
          <Button type="submit" className="h-11" disabled={!online || phase === "loading"}>
            发送
          </Button>
        </form>
        <motion.div
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
        >
          <label className="flex flex-col gap-1 text-sm">
            范围
            <select
              className="h-11 min-h-11 rounded-lg border bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={activeDay}
              onChange={(event) => setDayId(event.target.value)}
            >
              {detail.days.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.title}
                </option>
              ))}
            </select>
          </label>
          {online ? null : (
            <p className="text-sm leading-6">
              助手需要网络。已保存的日程仍可查看，不会被修改。
            </p>
          )}
          {needsKey ? <OwnerKeyForm /> : null}
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Button
                key={chip.label}
                type="button"
                variant="outline"
                className="h-11"
                disabled={!online || phase === "loading"}
                onClick={() => void send(chip.instruction)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
          {phase === "loading" ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              <p className="text-sm">正在起草调整。</p>
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-2/3" />
            </div>
          ) : null}
          {status ? <p className="text-sm text-pretty">{status}</p> : null}
          {phase === "idle" && history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              还没有对话。选一条快捷指令，或自己写一句。
            </p>
          ) : null}
          {rejected.length > 0 ? (
            <p className="text-sm text-muted-foreground">已忽略碰到锁定内容的修改。</p>
          ) : null}
          {phase === "preview" ? (
            <ul className="flex flex-col gap-2">
              {ops.map((op, index) => (
                <li key={`${op.op}-${index}`}>
                  <label className="flex min-h-11 items-center gap-3 rounded-lg bg-muted/50 px-3">
                    <input
                      type="checkbox"
                      className="size-11 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      checked={checked[index] === true}
                      aria-label={describeOp(detail, op)}
                      onChange={(event) =>
                        setChecked((current) =>
                          current.map((value, item) =>
                            item === index ? event.target.checked : value,
                          ),
                        )
                      }
                    />
                    <span className="text-sm">
                      {detail.days.find((day) => day.id === dayIdFor(detail, op))
                        ?.title ?? ""}{" "}
                      · {describeOp(detail, op)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          {conflicts.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {conflicts.map((conflict) => (
                <li
                  key={`${conflict.fromId}:${conflict.toId}:${conflict.kind}`}
                  className={
                    conflict.kind === "unverified"
                      ? "text-sm text-muted-foreground"
                      : "text-sm text-primary"
                  }
                >
                  {conflict.message}
                </li>
              ))}
            </ul>
          ) : null}
          {phase === "preview" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11"
                disabled={chosen.length === 0}
                onClick={() => void apply()}
              >
                应用所选
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  setPhase("idle");
                  setOps([]);
                  setRejected([]);
                }}
              >
                放弃
              </Button>
            </div>
          ) : null}
          {phase === "applied" || undoId || redoId ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={!undoId}
                onClick={() => void undo()}
              >
                撤销
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={!redoId}
                onClick={() => void redo()}
              >
                重做
              </Button>
            </div>
          ) : null}
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
}
