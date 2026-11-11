import { lazy, Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Compass, History, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MissingState } from "@/components/missing-state";
import { PageHeader } from "@/components/page-header";
import { TripSectionNav } from "@/components/trip-section-nav";
import { MapPanel } from "@/components/map-panel";
import { TimelineEditor } from "@/components/timeline-editor";
import { TripFormDrawer } from "@/components/trip-form-drawer";
import { VersionDrawer } from "@/components/version-drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db/database";
import { deleteTrip, restoreDeletedTrip } from "@/db/repository";
import { useTripDetail } from "@/hooks/use-travel-data";
import { formatDateRange } from "@/lib/dates";
import { notifyError, notifyUndo } from "@/lib/feedback";

const AssistantSheet = lazy(() =>
  import("@/components/assistant-sheet").then((module) => ({ default: module.AssistantSheet })),
);

export function TripDetailPage() {
  const { tripId = "" } = useParams();
  const navigate = useNavigate();
  const trip = useTripDetail(tripId);
  const [editing, setEditing] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteTrip(db, tripId),
    onSuccess: (deleted) => {
      notifyUndo("行程已删除", async () => {
        await restoreDeletedTrip(db, deleted);
        await navigate(`/trips/${deleted.snapshot.trip.id}`);
      });
      void navigate("/");
    },
    onError: (error) => notifyError(error),
  });

  if (trip === undefined) {
    return (
      <>
        <PageHeader
          title="行程"
          eyebrow="旅序"
          backTo="/"
          footer={<TripSectionNav tripId={tripId} />}
        />
        <div className="flex flex-col gap-4 px-4 py-6" aria-busy="true">
          <p className="sr-only">正在读取行程</p>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (trip === null) {
    return (
      <>
        <PageHeader title="找不到行程" eyebrow="旅序" backTo="/" />
        <section className="px-4 py-6">
          <MissingState
            icon={<Compass />}
            title="这趟行程不存在"
            description="它可能已经删除，或这个地址写错了。列表里还有留在这台设备上的行程。"
          />
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={trip.title}
        eyebrow={trip.destination}
        backTo="/"
        footer={<TripSectionNav tripId={trip.id} />}
        action={
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="助手"
              onClick={() => setAssistantOpen(true)}
            >
              <Sparkles aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="版本记录"
              onClick={() => setVersionsOpen(true)}
            >
              <History aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="编辑行程"
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="删除行程"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        }
      />
      <section className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatDateRange(trip.startDate, trip.endDate)} · {trip.dayCount} 天
          </p>
          <p className="text-sm leading-6">{trip.summary}</p>
        </div>
        <MapPanel
          tripId={trip.id}
          destination={trip.destination}
          days={trip.days}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <TimelineEditor detail={trip} selectedId={selectedId} onSelect={setSelectedId} />
      </section>
      {assistantOpen ? (
        <Suspense fallback={null}>
          <AssistantSheet
            open={assistantOpen}
            onOpenChange={setAssistantOpen}
            detail={trip}
            selectedId={selectedId}
          />
        </Suspense>
      ) : null}
      <TripFormDrawer open={editing} onOpenChange={setEditing} trip={trip} />
      <VersionDrawer
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        tripId={trip.id}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="删除这趟行程？"
        description="删除后可以立刻撤销。"
        confirmLabel="删除"
        destructive
        pending={remove.isPending}
        onOpenChange={setConfirmDelete}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
