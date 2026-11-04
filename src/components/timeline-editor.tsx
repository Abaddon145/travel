import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { DayFormDrawer } from "@/components/day-form-drawer";
import { ItemFormDrawer } from "@/components/item-form-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TripTimeline } from "@/components/trip-timeline";
import { Button } from "@/components/ui/button";
import { db } from "@/db/database";
import {
  deleteDay,
  deleteTimelineItem,
  moveTimelineItem,
  restoreVersion,
  setDayLock,
  setTimelineLock,
} from "@/db/repository";
import type { DayView, TimelineEntry, TripDetail } from "@/domain/types";
import { notifyError, notifySuccess, notifyUndo } from "@/lib/feedback";

type ConfirmState =
  { kind: "day"; day: DayView } | { kind: "item"; item: TimelineEntry } | null;

export function TimelineEditor({
  detail,
  selectedId,
  onSelect,
}: {
  detail: TripDetail;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [dayOpen, setDayOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<DayView | null>(null);
  const [itemDayId, setItemDayId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<TimelineEntry | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const removeDay = useMutation({
    mutationFn: (dayId: string) => deleteDay(db, dayId),
    onSuccess: (versionId) => {
      setConfirm(null);
      if (versionId) {
        notifyUndo("这一天已删除", () => restoreVersion(db, versionId));
      }
    },
    onError: (error) => notifyError(error),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => deleteTimelineItem(db, itemId),
    onSuccess: (versionId) => {
      setConfirm(null);
      if (versionId) {
        notifyUndo("已删除", () => restoreVersion(db, versionId));
      }
    },
    onError: (error) => notifyError(error),
  });

  const move = useMutation({
    mutationFn: (input: { id: string; direction: "up" | "down" }) =>
      moveTimelineItem(db, input.id, input.direction),
    onSuccess: (moved) => {
      if (moved) notifySuccess("顺序已更新");
    },
    onError: (error) => notifyError(error),
  });

  const lock = useMutation({
    mutationFn: (input: { id: string; locked: boolean }) =>
      setTimelineLock(db, input.id, input.locked),
    onSuccess: (_result, input) => notifySuccess(input.locked ? "已锁定" : "已解锁"),
    onError: (error) => notifyError(error),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEditingDay(null);
            setDayOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          添加一天
        </Button>
      </div>
      {detail.days.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有安排日期。先添加一天。</p>
      ) : (
        <TripTimeline
          days={detail.days}
          selectedId={selectedId}
          onSelect={onSelect}
          onReorder={(item, direction) => move.mutate({ id: item.id, direction })}
          renderDayFooter={(day) => (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                锁定自
                <input
                  type="time"
                  className="h-11 rounded-lg border bg-background px-2 text-sm text-foreground"
                  value={day.lockedFrom ?? ""}
                  aria-label={`${day.title}锁定开始`}
                  onChange={(event) =>
                    void setDayLock(db, day.id, day.locked === true, {
                      from: event.target.value,
                      to: day.lockedTo ?? "",
                    })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                锁定至
                <input
                  type="time"
                  className="h-11 rounded-lg border bg-background px-2 text-sm text-foreground"
                  value={day.lockedTo ?? ""}
                  aria-label={`${day.title}锁定结束`}
                  onChange={(event) =>
                    void setDayLock(db, day.id, day.locked === true, {
                      from: day.lockedFrom ?? "",
                      to: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          )}
          renderDayActions={(day) => {
            const blocked = day.items.some((item) => item.locked);
            return (
              <>
                <Button
                  type="button"
                  variant={day.locked ? "secondary" : "ghost"}
                  size="icon"
                  aria-pressed={day.locked === true}
                  aria-label={day.locked ? `解锁${day.title}` : `锁定${day.title}`}
                  onClick={() => void setDayLock(db, day.id, day.locked !== true)}
                >
                  {day.locked ? <Lock /> : <LockOpen />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑${day.title}`}
                  onClick={() => {
                    setEditingDay(day);
                    setDayOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`删除${day.title}`}
                  disabled={blocked}
                  onClick={() => setConfirm({ kind: "day", day })}
                >
                  <Trash2 />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`在${day.title}添加项目`}
                  onClick={() => {
                    setEditingItem(null);
                    setItemDayId(day.id);
                  }}
                >
                  <Plus />
                </Button>
              </>
            );
          }}
          renderItemActions={(item) => {
            const day = detail.days.find((entry) =>
              entry.items.some((row) => row.id === item.id),
            );
            const index = day?.items.findIndex((row) => row.id === item.id) ?? -1;
            const previous = index > 0 ? day?.items[index - 1] : undefined;
            const next = day && index >= 0 ? day.items[index + 1] : undefined;
            const upDisabled = item.locked || !previous || previous.locked;
            const downDisabled = item.locked || !next || next.locked;
            return (
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`上移${item.name}`}
                  disabled={upDisabled || move.isPending}
                  onClick={() => move.mutate({ id: item.id, direction: "up" })}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`下移${item.name}`}
                  disabled={downDisabled || move.isPending}
                  onClick={() => move.mutate({ id: item.id, direction: "down" })}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant={item.locked ? "secondary" : "outline"}
                  size="icon"
                  aria-pressed={item.locked}
                  aria-label={item.locked ? `解锁${item.name}` : `锁定${item.name}`}
                  onClick={() => lock.mutate({ id: item.id, locked: !item.locked })}
                >
                  {item.locked ? <Lock /> : <LockOpen />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`编辑${item.name}`}
                  disabled={item.locked}
                  onClick={() => {
                    if (!day) return;
                    setEditingItem(item);
                    setItemDayId(day.id);
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`删除${item.name}`}
                  disabled={item.locked}
                  onClick={() => setConfirm({ kind: "item", item })}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          }}
        />
      )}
      <DayFormDrawer
        open={dayOpen}
        onOpenChange={setDayOpen}
        tripId={detail.id}
        day={editingDay}
      />
      <ItemFormDrawer
        open={Boolean(itemDayId)}
        onOpenChange={(open) => {
          if (!open) {
            setItemDayId(null);
            setEditingItem(null);
          }
        }}
        dayId={itemDayId ?? ""}
        item={editingItem}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === "day" ? "删除这一天？" : "删除这个项目？"}
        description={
          confirm?.kind === "day"
            ? "这一天和其中未锁定的项目会一起删除。可以马上撤销。"
            : "可以从刚刚的提示里撤销。"
        }
        confirmLabel="删除"
        destructive
        pending={removeDay.isPending || removeItem.isPending}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "day") removeDay.mutate(confirm.day.id);
          else removeItem.mutate(confirm.item.id);
        }}
      />
    </>
  );
}
