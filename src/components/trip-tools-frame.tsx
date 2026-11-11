import type { ReactNode } from "react";
import { Compass } from "lucide-react";
import { MissingState } from "@/components/missing-state";
import { PageHeader } from "@/components/page-header";
import { TripSectionNav } from "@/components/trip-section-nav";
import { Skeleton } from "@/components/ui/skeleton";
import type { TripDetail } from "@/domain/types";
import { useTripDetail } from "@/hooks/use-travel-data";

export function TripToolsFrame({
  tripId,
  title,
  action,
  children,
}: {
  tripId: string;
  title: string;
  action?: ReactNode;
  children: (trip: TripDetail) => ReactNode;
}) {
  const trip = useTripDetail(tripId);

  if (trip === undefined) {
    return (
      <>
        <PageHeader
          title={title}
          eyebrow="旅序"
          backTo="/"
          footer={<TripSectionNav tripId={tripId} />}
        />
        <div className="flex flex-col gap-4 px-4 py-6" aria-busy="true">
          <p className="sr-only">正在读取{title}</p>
          <Skeleton className="h-24 w-full" />
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
        title={title}
        eyebrow={trip.destination}
        backTo="/"
        action={action}
        footer={<TripSectionNav tripId={tripId} />}
      />
      <section className="flex flex-col gap-6 px-4 py-6">{children(trip)}</section>
    </>
  );
}
