import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useParams } from "react-router";
import { BookingFormDrawer } from "@/components/booking-form-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TripToolsFrame } from "@/components/trip-tools-frame";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db/database";
import { deleteBooking, restoreBooking } from "@/db/tools";
import type { Booking, BookingKind } from "@/domain/types";
import { useTripTools } from "@/hooks/use-trip-tools";
import { formatDateWithWeekday } from "@/lib/dates";
import { notifyError, notifyUndo } from "@/lib/feedback";

const groups: { kind: BookingKind; title: string; empty: string }[] = [
  { kind: "lodging", title: "住宿", empty: "还没有住宿。" },
  { kind: "train", title: "车次", empty: "还没有车次。" },
  { kind: "reservation", title: "预订", empty: "还没有其他预订。" },
];

export function BookingsPage() {
  const { tripId = "" } = useParams();
  const tools = useTripTools(tripId);
  const [preset, setPreset] = useState<BookingKind | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Booking | null>(null);
  const remove = useMutation({
    mutationFn: (bookingId: string) => deleteBooking(db, bookingId),
    onSuccess: (booking) => {
      setPendingDelete(null);
      notifyUndo("预订已删除", () => restoreBooking(db, booking));
    },
    onError: (error) => notifyError(error),
  });

  return (
    <TripToolsFrame tripId={tripId} title="预订">
      {(trip) => {
        const bookings = tools?.bookings ?? [];
        return (
          <>
            {tools === undefined ? (
              <div className="flex flex-col gap-4" aria-busy="true">
                <p className="sr-only">正在读取预订</p>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : bookings.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>还没有预订</EmptyTitle>
                  <EmptyDescription>
                    住宿、车次和确认号记在这里，并挂到对应的日期。花费请记在预算里。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {tools === undefined
              ? null
              : groups.map((group) => {
                  const rows = bookings.filter((booking) => booking.kind === group.kind);
                  return (
                    <section key={group.kind} className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-medium">{group.title}</h2>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setEditing(null);
                            setPreset(group.kind);
                          }}
                        >
                          <Plus data-icon="inline-start" />
                          添加
                        </Button>
                      </div>
                      {rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{group.empty}</p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {rows.map((booking) => (
                            <li key={booking.id} className="flex flex-col gap-2 py-4">
                              <p className="text-sm">{booking.title}</p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {formatDateWithWeekday(booking.date)}
                                {booking.endDate
                                  ? ` – ${formatDateWithWeekday(booking.endDate)}`
                                  : ""}
                              </p>
                              {booking.reference ? (
                                <p className="text-sm tabular-nums">{booking.reference}</p>
                              ) : null}
                              {booking.detail ? (
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {booking.detail}
                                </p>
                              ) : null}
                              {booking.note ? (
                                <p className="text-sm leading-6 text-muted-foreground">
                                  {booking.note}
                                </p>
                              ) : null}
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPreset(null);
                                    setEditing(booking);
                                  }}
                                >
                                  编辑
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`删除${booking.title}`}
                                  onClick={() => setPendingDelete(booking)}
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
                  );
                })}
            <BookingFormDrawer
              open={Boolean(preset) || Boolean(editing)}
              onOpenChange={(open) => {
                if (!open) {
                  setPreset(null);
                  setEditing(null);
                }
              }}
              tripId={trip.id}
              booking={editing}
              presetKind={preset ?? undefined}
            />
            <ConfirmDialog
              open={Boolean(pendingDelete)}
              title="删除这条预订？"
              description="删除后可以立刻撤销。预算里的金额不会一起删掉。"
              confirmLabel="删除"
              destructive
              pending={remove.isPending}
              onOpenChange={(open) => {
                if (!open) setPendingDelete(null);
              }}
              onConfirm={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
              }}
            />
          </>
        );
      }}
    </TripToolsFrame>
  );
}
