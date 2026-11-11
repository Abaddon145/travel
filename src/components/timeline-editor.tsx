import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Lock, LockOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { DayFormDrawer } from "@/components/day-form-drawer";
import { ItemFormDrawer } from "@/components/item-form-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TripTimeline } from "@/components/trip-timeline";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { notifyError, notifyUndo } from "@/lib/feedback";

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
  const [activeItem, setActiveItem] = useState<TimelineEntry | null>(null);
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
      setActiveItem(null);
      if (versionId) {
        notifyUndo("已删除", () => restoreVersion(db, versionId));
      }
    },
    onError: (error) => notifyError(error),
  });

  const move = useMutation({
    mutationFn: (input: { id: string; direction: "up" | "down" }) =>
      moveTimelineItem(db, input.id, input.direction),
    onError: (error) => notifyError(error),
  });

  const lock = useMutation({
    mutationFn: (input: { id: string; locked: boolean }) =>
      setTimelineLock(db, input.id, input.locked),
    onSuccess: (_result, input) => {
      setActiveItem((current) => (current ? { ...current, locked: input.locked } : current));
    },
    onError: (error) => notifyError(error),
  });

  const current = activeItem
    ? (detail.days.flatMap((day) => day.items).find((item) => item.id === activeItem.id) ?? null)
    : null;

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
          <Plus aria-hidden="true" data-icon="inline-start" />
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
          onOpen={setActiveItem}
          onDelete={(item) => {
            if (!item.locked) setConfirm({ kind: "item", item });
          }}
          onReorder={(item, direction) => move.mutate({ id: item.id, direction })}
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
                  {day.locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
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
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`删除${day.title}`}
                  disabled={blocked}
                  onClick={() => setConfirm({ kind: "day", day })}
                >
                  <Trash2 aria-hidden="true" />
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
                  <Plus aria-hidden="true" />
                </Button>
              </>
            );
          }}
        />
      )}
      <ItemActions
        detail={detail}
        item={current}
        pending={move.isPending}
        onClose={() => setActiveItem(null)}
        onMove={(direction) => {
          if (current) move.mutate({ id: current.id, direction });
        }}
        onLock={() => {
          if (current) lock.mutate({ id: current.id, locked: !current.locked });
        }}
        onEdit={() => {
          if (!current) return;
          const day = detail.days.find((entry) => entry.items.some((row) => row.id === current.id));
          if (!day) return;
          setEditingItem(current);
          setItemDayId(day.id);
          setActiveItem(null);
        }}
        onDelete={() => {
          if (current) setConfirm({ kind: "item", item: current });
        }}
      />
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

function ItemActions({
  detail,
  item,
  pending,
  onClose,
  onMove,
  onLock,
  onEdit,
  onDelete,
}: {
  detail: TripDetail;
  item: TimelineEntry | null;
  pending: boolean;
  onClose: () => void;
  onMove: (direction: "up" | "down") => void;
  onLock: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const day = item
    ? detail.days.find((entry) => entry.items.some((row) => row.id === item.id))
    : undefined;
  const index = day?.items.findIndex((row) => row.id === item?.id) ?? -1;
  const previous = index > 0 ? day?.items[index - 1] : undefined;
  const next = day && index >= 0 ? day.items[index + 1] : undefined;
  const upDisabled = !item || item.locked || !previous || previous.locked;
  const downDisabled = !item || item.locked || !next || next.locked;

  return (
    <Drawer open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DrawerContent>
        <div className="flex items-center gap-2 px-4 pt-2">
          <DrawerTitle className="min-w-0 flex-1 truncate">{item?.name ?? "项目"}</DrawerTitle>
          <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
            关闭
          </Button>
        </div>
        <DrawerDescription className="px-4 pt-2">
          左滑这项可以删除，长按后上下拖动可以排序。下面的按钮做同样的事。
        </DrawerDescription>
        {item ? (
          <div className="flex flex-col gap-2 overflow-y-auto px-4 py-4 pb-safe">
            <Button type="button" variant="outline" className="h-11 justify-start" aria-label={`上移${item.name}`} disabled={upDisabled || pending} onClick={() => onMove("up")}>
              <ArrowUp aria-hidden="true" data-icon="inline-start" />
              上移
            </Button>
            <Button type="button" variant="outline" className="h-11 justify-start" aria-label={`下移${item.name}`} disabled={downDisabled || pending} onClick={() => onMove("down")}>
              <ArrowDown aria-hidden="true" data-icon="inline-start" />
              下移
            </Button>
            <Button type="button" variant={item.locked ? "secondary" : "outline"} className="h-11 justify-start" aria-pressed={item.locked} aria-label={item.locked ? `解锁${item.name}` : `锁定${item.name}`} onClick={onLock}>
              {item.locked ? <Lock aria-hidden="true" data-icon="inline-start" /> : <LockOpen aria-hidden="true" data-icon="inline-start" />}
              {item.locked ? "解锁" : "锁定"}
            </Button>
            <Button type="button" variant="outline" className="h-11 justify-start" aria-label={`编辑${item.name}`} disabled={item.locked} onClick={onEdit}>
              <Pencil aria-hidden="true" data-icon="inline-start" />
              编辑
            </Button>
            <Button type="button" variant="outline" className="h-11 justify-start" aria-label={`删除${item.name}`} disabled={item.locked} onClick={onDelete}>
              <Trash2 aria-hidden="true" data-icon="inline-start" />
              删除
            </Button>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
