import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { TripFormDrawer } from "@/components/trip-form-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db/database";
import { deleteTrip, restoreDeletedTrip } from "@/db/repository";
import type { TripSummary } from "@/domain/types";
import { useTripSummaries } from "@/hooks/use-travel-data";
import { formatDateRange } from "@/lib/dates";
import { notifyError, notifyUndo } from "@/lib/feedback";

export function TripsPage() {
  const trips = useTripSummaries();
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TripSummary | null>(null);
  const remove = useMutation({
    mutationFn: (tripId: string) => deleteTrip(db, tripId),
    onSuccess: (deleted) => {
      setPendingDelete(null);
      notifyUndo("行程已删除", () => restoreDeletedTrip(db, deleted));
    },
    onError: (error) => notifyError(error),
  });

  return (
    <>
      <PageHeader
        title="行程"
        eyebrow="旅序"
        action={
          <Button type="button" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            新建行程
          </Button>
        }
      />
      <section className="flex flex-col gap-4 px-4 py-6">
        <Button variant="outline" className="h-11" asChild>
          <Link to="/plan">用 AI 起草</Link>
        </Button>
        {trips === undefined ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <p className="sr-only">正在读取行程</p>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : trips.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>还没有行程</EmptyTitle>
              <EmptyDescription>
                新建一趟旅行后，每天的景点与住宿会排在这里。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-4">
            {trips.map((trip) => (
              <li key={trip.id} className="flex flex-col gap-2">
                <Link to={`/trips/${trip.id}`} className="block">
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{trip.destination}</Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatDateRange(trip.startDate, trip.endDate)}
                        </span>
                      </div>
                      <CardTitle>{trip.title}</CardTitle>
                      <CardDescription>{trip.summary}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`删除${trip.title}`}
                    onClick={() => setPendingDelete(trip)}
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
      <TripFormDrawer open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除这趟行程？"
        description="景点和住宿会一起删除。删除后可以立刻撤销。"
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
}
