import { Link } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { listTripSummaries } from "@/data/mock-trips";
import type { TripSummary } from "@/domain/types";
import { formatDateRange } from "@/lib/dates";
import { CalendarDays } from "lucide-react";

export function TripsPage({ trips = listTripSummaries() }: { trips?: TripSummary[] }) {
  return (
    <>
      <PageHeader title="行程" eyebrow="旅序" />
      <section className="flex flex-col gap-4 px-4 py-6">
        {trips.length === 0 ? (
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
              <li key={trip.id}>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
