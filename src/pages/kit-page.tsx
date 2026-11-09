import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useParams } from "react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { KitFormDrawer } from "@/components/kit-form-drawer";
import { TripToolsFrame } from "@/components/trip-tools-frame";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db/database";
import {
  deleteChecklistItem,
  deleteFavorite,
  deleteTravelNote,
  restoreChecklistItem,
  restoreFavorite,
  restoreTravelNote,
  updateChecklistItem,
} from "@/db/tools";
import type { ChecklistItem, Favorite, TravelNote } from "@/domain/types";
import { useTripTools } from "@/hooks/use-trip-tools";
import { formatDateWithWeekday } from "@/lib/dates";
import { notifyError, notifyUndo } from "@/lib/feedback";
import { cn } from "@/lib/utils";

type Target =
  | { kind: "checklist"; item: ChecklistItem }
  | { kind: "favorite"; item: Favorite }
  | { kind: "note"; item: TravelNote };

export function KitPage() {
  const { tripId = "" } = useParams();
  const tools = useTripTools(tripId);
  const [mode, setMode] = useState<"checklist" | "favorite" | "note" | null>(null);
  const [editing, setEditing] = useState<Target | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Target | null>(null);
  const toggle = useMutation({
    mutationFn: (item: ChecklistItem) =>
      updateChecklistItem(db, item.id, {
        title: item.title,
        note: item.note,
        done: !item.done,
      }),
    onError: (error) => notifyError(error),
  });
  const remove = useMutation({
    mutationFn: async (target: Target) => {
      if (target.kind === "checklist") return deleteChecklistItem(db, target.item.id);
      if (target.kind === "favorite") return deleteFavorite(db, target.item.id);
      return deleteTravelNote(db, target.item.id);
    },
    onSuccess: (record, target) => {
      setPendingDelete(null);
      const undo =
        target.kind === "checklist"
          ? () => restoreChecklistItem(db, record)
          : target.kind === "favorite"
            ? () => restoreFavorite(db, record)
            : () => restoreTravelNote(db, record);
      notifyUndo("已删除", undo);
    },
    onError: (error) => notifyError(error),
  });

  return (
    <TripToolsFrame tripId={tripId} title="清单">
      {(trip) => {
        const dates = trip.days.map((day) => ({
          value: day.date,
          label: `${formatDateWithWeekday(day.date)} ${day.title}`,
        }));
        const openCreate = (next: "checklist" | "favorite" | "note") => {
          setEditing(null);
          setMode(next);
        };
        const nothing =
          tools !== undefined &&
          tools.checklistItems.length === 0 &&
          tools.favorites.length === 0 &&
          tools.travelNotes.length === 0;
        return (
          <>
            {tools === undefined ? (
              <div className="flex flex-col gap-4" aria-busy="true">
                <p className="sr-only">正在读取清单</p>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                {nothing ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>还没有清单</EmptyTitle>
                      <EmptyDescription>
                        出发前的事项、想去但还没排进日程的地方，以及只给自己看的备注，都记在这里。
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : null}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">清单</h2>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openCreate("checklist")}
                    >
                      <Plus data-icon="inline-start" />
                      添加
                    </Button>
                  </div>
                  {tools.checklistItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">还没有事项。</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {tools.checklistItems.map((item) => (
                        <li key={item.id} className="flex flex-col gap-2 py-3">
                          <label className="flex min-h-11 items-center gap-3">
                            <input
                              type="checkbox"
                              className="size-11 shrink-0 accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                              checked={item.done}
                              onChange={() => toggle.mutate(item)}
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block text-sm leading-6",
                                  item.done && "text-muted-foreground line-through",
                                )}
                              >
                                {item.title}
                              </span>
                              {item.note ? (
                                <span className="block text-sm leading-6 text-muted-foreground">
                                  {item.note}
                                </span>
                              ) : null}
                            </span>
                          </label>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setMode(null);
                                setEditing({ kind: "checklist", item });
                              }}
                            >
                              编辑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`删除${item.title}`}
                              onClick={() =>
                                setPendingDelete({ kind: "checklist", item })
                              }
                            >
                              <Trash2 data-icon="inline-start" />
                              删除
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">收藏</h2>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openCreate("favorite")}
                    >
                      <Plus data-icon="inline-start" />
                      添加
                    </Button>
                  </div>
                  {tools.favorites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">还没有收藏。</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {tools.favorites.map((item) => (
                        <li key={item.id} className="flex flex-col gap-2 py-4">
                          <p className="text-sm">{item.title}</p>
                          {item.note ? (
                            <p className="text-sm leading-6 text-muted-foreground">
                              {item.note}
                            </p>
                          ) : null}
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setMode(null);
                                setEditing({ kind: "favorite", item });
                              }}
                            >
                              编辑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`删除${item.title}`}
                              onClick={() => setPendingDelete({ kind: "favorite", item })}
                            >
                              <Trash2 data-icon="inline-start" />
                              删除
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">备注</h2>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openCreate("note")}
                    >
                      <Plus data-icon="inline-start" />
                      添加
                    </Button>
                  </div>
                  {tools.travelNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">还没有备注。</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {tools.travelNotes.map((item) => (
                        <li key={item.id} className="flex flex-col gap-2 py-4">
                          <p className="text-sm">{item.title}</p>
                          {item.date ? (
                            <p className="text-xs text-muted-foreground">
                              {formatDateWithWeekday(item.date)}
                            </p>
                          ) : null}
                          <p className="text-sm leading-6 text-muted-foreground">
                            {item.body}
                          </p>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setMode(null);
                                setEditing({ kind: "note", item });
                              }}
                            >
                              编辑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`删除${item.title}`}
                              onClick={() => setPendingDelete({ kind: "note", item })}
                            >
                              <Trash2 data-icon="inline-start" />
                              删除
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
            <KitFormDrawer
              open={Boolean(mode) || Boolean(editing)}
              onOpenChange={(open) => {
                if (!open) {
                  setMode(null);
                  setEditing(null);
                }
              }}
              tripId={trip.id}
              mode={editing?.kind ?? mode ?? "checklist"}
              checklist={editing?.kind === "checklist" ? editing.item : null}
              favorite={editing?.kind === "favorite" ? editing.item : null}
              note={editing?.kind === "note" ? editing.item : null}
              dates={dates}
            />
            <ConfirmDialog
              open={Boolean(pendingDelete)}
              title="删除这条记录？"
              description="删除后可以立刻撤销。"
              confirmLabel="删除"
              destructive
              pending={remove.isPending}
              onOpenChange={(open) => {
                if (!open) setPendingDelete(null);
              }}
              onConfirm={() => {
                if (pendingDelete) remove.mutate(pendingDelete);
              }}
            />
          </>
        );
      }}
    </TripToolsFrame>
  );
}
