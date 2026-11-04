import { useParams } from "react-router";
import { PageHeader } from "@/components/page-header";
import { TripTimeline } from "@/components/trip-timeline";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getTripDetail } from "@/data/mock-trips";
import { formatDateRange } from "@/lib/dates";

export function TripDetailPage() {
  const { tripId = "" } = useParams();
  const trip = getTripDetail(tripId);

  if (!trip) {
    return (
      <>
        <PageHeader title="找不到行程" eyebrow="旅序" backTo="/" />
        <section className="px-4 py-6">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>这趟行程不存在</EmptyTitle>
              <EmptyDescription>返回列表，选择另一段旅程。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={trip.title} eyebrow={trip.destination} backTo="/" />
      <section className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {formatDateRange(trip.startDate, trip.endDate)} · {trip.dayCount} 天
          </p>
          <p className="text-sm leading-6">{trip.summary}</p>
        </div>
        <TripTimeline days={trip.days} />
      </section>
    </>
  );
}
