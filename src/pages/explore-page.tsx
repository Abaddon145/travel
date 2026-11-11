import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTripDetail, useTripSummaries } from "@/hooks/use-travel-data";
import { formatDateWithWeekday } from "@/lib/dates";
import { useOnline } from "@/lib/online";
import { nextStop, pickFocusTrip, tripStatusLabel } from "@/lib/trip-phase";
import { readPlaceWeather } from "@/lib/weather";

export function ExplorePage() {
  const online = useOnline();
  const trips = useTripSummaries();
  const focus = trips ? pickFocusTrip(trips) : undefined;
  const detail = useTripDetail(focus?.id ?? "");
  const weather = useQuery({
    queryKey: ["weather", focus?.destination ?? ""],
    queryFn: () => readPlaceWeather(focus?.destination ?? ""),
    enabled: Boolean(focus?.destination),
    retry: false,
  });
  const stop = detail ? nextStop(detail) : null;

  return (
    <>
      <PageHeader title="今天" eyebrow="旅序" />
      <section className="flex flex-col gap-4 px-4 py-6">
        {trips === undefined || (focus && detail === undefined) ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <p className="sr-only">正在整理今天</p>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !focus || detail === null ? (
          <Card>
            <CardHeader>
              <CardTitle>还没有要出发的行程</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm leading-6 text-muted-foreground">
                建好一趟行程后，这里会告诉你还要几天、下一站，以及当地天气。
              </p>
              <Button className="h-11" asChild>
                <Link to="/">去看行程</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{focus.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm font-medium">{tripStatusLabel(focus)}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {focus.destination} · {focus.summary}
                </p>
                <Button className="h-11" variant="outline" asChild>
                  <Link to={`/trips/${focus.id}`}>打开日程</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium">下一站</h2>
              </CardHeader>
              <CardContent>
                {stop ? (
                  <p className="text-sm leading-6">
                    {formatDateWithWeekday(stop.day.date)} · {stop.item.timeLabel || "未定时"} ·{" "}
                    {stop.item.name}
                    {stop.item.note ? `。${stop.item.note}` : ""}
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">这一趟还没有安排。</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-medium">天气</h2>
              </CardHeader>
              <CardContent>
                {!online ? (
                  <p className="text-sm leading-6 text-muted-foreground">天气需要网络。</p>
                ) : weather.isPending ? (
                  <p className="text-sm" aria-busy="true">
                    正在查看{focus.destination}的天气。
                  </p>
                ) : weather.data?.ok ? (
                  <p className="text-sm leading-6">
                    {focus.destination} {weather.data.label} {weather.data.temperature}°
                  </p>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">暂时查不到当地天气。</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </>
  );
}
