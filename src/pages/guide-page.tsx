import { Link, useParams } from "react-router";
import { Compass } from "lucide-react";
import { MissingState } from "@/components/missing-state";
import { PageHeader } from "@/components/page-header";
import { TripSectionNav } from "@/components/trip-section-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  budgetReport,
  categoryLabel,
  currencyLabel,
  explainVariance,
  formatMinor,
} from "@/domain/money";
import type { BookingKind, TripDetail, TripTools } from "@/domain/types";
import { useTripTools } from "@/hooks/use-trip-tools";
import { useTripDetail } from "@/hooks/use-travel-data";
import { formatDateRange, formatDateWithWeekday } from "@/lib/dates";

const bookingKindLabel: Record<BookingKind, string> = {
  lodging: "住宿",
  train: "车次",
  reservation: "预订",
};

function GuideBody({ detail, tools }: { detail: TripDetail; tools: TripTools }) {
  const reports = budgetReport(tools.ledgerEntries);
  const bookings = [...tools.bookings].sort((a, b) => a.date.localeCompare(b.date));
  const checklist = [...tools.checklistItems].sort((a, b) => a.order - b.order);
  const notes = [...tools.travelNotes].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <article className="guide-sheet flex flex-col gap-8 px-4 py-6" data-testid="guide-sheet">
      <header className="flex flex-col gap-2">
        <p className="text-xs tracking-wide text-muted-foreground">旅序 · 行程攻略</p>
        <h1 className="text-2xl font-medium tracking-tight">{detail.title}</h1>
        <p className="text-sm text-muted-foreground">
          {detail.destination} · {formatDateRange(detail.startDate, detail.endDate)} ·{" "}
          {detail.dayCount} 天
        </p>
        {detail.summary ? <p className="text-sm leading-6">{detail.summary}</p> : null}
      </header>
      <div className="no-print flex flex-col gap-3">
        <Button type="button" className="h-11" onClick={() => window.print()}>
          打印或存储为 PDF
        </Button>
        <p className="text-sm leading-6 text-muted-foreground">
          在 iPhone 上点此按钮，于打印面板选择「存储为 PDF」，或从分享菜单存到文件。攻略在这台设备上排版，不上传。中文使用系统字体，优先苹方、冬青黑体、思源黑体与微软雅黑。
        </p>
      </div>
      <section className="guide-block flex flex-col gap-4">
        <h2 className="text-lg font-medium">日程</h2>
        {detail.days.length === 0 ? (
          <p className="text-sm text-muted-foreground">这一节还没有内容。</p>
        ) : (
          detail.days.map((day) => (
            <div key={day.id} className="guide-block flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {formatDateWithWeekday(day.date)} · {day.title}
              </h3>
              {day.note ? <p className="text-sm leading-6 text-muted-foreground">{day.note}</p> : null}
              {day.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">这一天还没有安排。</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {day.items.map((item) => (
                    <li key={item.id} className="text-sm leading-6">
                      <span className="tabular-nums text-muted-foreground">
                        {item.timeLabel || "未定时"}
                      </span>{" "}
                      {item.name}
                      {item.area ? ` · ${item.area}` : ""}
                      {item.kind === "lodging" ? " · 住宿" : ""}
                      {item.note ? `。${item.note}` : ""}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))
        )}
      </section>
      <section className="guide-block flex flex-col gap-4">
        <h2 className="text-lg font-medium">预算</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">这一节还没有内容。</p>
        ) : (
          reports.map((report) => (
            <div key={report.currency} className="guide-block flex flex-col gap-2">
              <h3 className="text-sm font-medium">{currencyLabel[report.currency]}</h3>
              <p className="text-sm tabular-nums">
                预计 {formatMinor(report.total.plannedMinor, report.currency)} · 实际{" "}
                {formatMinor(report.total.actualMinor, report.currency)}
              </p>
              <p className="text-sm text-muted-foreground">
                {explainVariance(report.total, report.currency)}
              </p>
              <ul className="flex flex-col gap-1">
                {report.categories.map((slice) => (
                  <li key={slice.category} className="flex justify-between gap-3 text-sm">
                    <span>{categoryLabel[slice.category]}</span>
                    <span className="tabular-nums">
                      {formatMinor(slice.plannedMinor, report.currency)} /{" "}
                      {formatMinor(slice.actualMinor, report.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <section className="guide-block flex flex-col gap-3">
        <h2 className="text-lg font-medium">预订</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">这一节还没有内容。</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bookings.map((booking) => (
              <li key={booking.id} className="guide-block text-sm leading-6">
                <p className="font-medium">
                  {bookingKindLabel[booking.kind]} · {booking.title}
                </p>
                <p className="text-muted-foreground">
                  {formatDateWithWeekday(booking.date)}
                  {booking.endDate ? ` – ${formatDateWithWeekday(booking.endDate)}` : ""}
                  {booking.reference ? ` · ${booking.reference}` : ""}
                </p>
                {booking.detail ? <p>{booking.detail}</p> : null}
                {booking.note ? <p className="text-muted-foreground">{booking.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="guide-block flex flex-col gap-3">
        <h2 className="text-lg font-medium">清单</h2>
        {checklist.length === 0 ? (
          <p className="text-sm text-muted-foreground">这一节还没有内容。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {checklist.map((item) => (
              <li key={item.id} className="text-sm leading-6">
                {item.done ? "已完成" : "未完成"} · {item.title}
                {item.note ? `。${item.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="guide-block flex flex-col gap-3">
        <h2 className="text-lg font-medium">收藏</h2>
        {tools.favorites.length === 0 ? (
          <p className="text-sm text-muted-foreground">这一节还没有内容。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tools.favorites.map((item) => (
              <li key={item.id} className="text-sm leading-6">
                {item.title}
                {item.note ? `。${item.note}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="guide-block flex flex-col gap-3">
        <h2 className="text-lg font-medium">备注</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">这一节还没有内容。</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="guide-block text-sm leading-6">
              <p className="font-medium">
                {note.title}
                {note.date ? ` · ${formatDateWithWeekday(note.date)}` : ""}
              </p>
              <p>{note.body}</p>
            </div>
          ))
        )}
      </section>
      <p className="no-print">
        <Button className="h-11" variant="outline" asChild>
          <Link to={`/trips/${detail.id}`}>返回日程</Link>
        </Button>
      </p>
    </article>
  );
}

export function GuidePage() {
  const { tripId = "" } = useParams();
  const trip = useTripDetail(tripId);
  const tools = useTripTools(tripId);

  if (trip === undefined || (trip && tools === undefined)) {
    return (
      <>
        <div className="no-print">
          <PageHeader title="攻略" eyebrow="旅序" backTo={`/trips/${tripId}`} />
        </div>
        <div className="flex flex-col gap-4 px-4 py-6" aria-busy="true">
          <p className="sr-only">正在整理攻略</p>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      </>
    );
  }

  if (trip === null) {
    return (
      <>
        <div className="no-print">
          <PageHeader title="找不到行程" eyebrow="旅序" backTo="/" />
        </div>
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
      <div className="no-print">
        <PageHeader
          title="攻略"
          eyebrow={trip.title}
          backTo={`/trips/${trip.id}`}
          footer={<TripSectionNav tripId={trip.id} />}
        />
      </div>
      <GuideBody detail={trip} tools={tools ?? {
        ledgerEntries: [],
        bookings: [],
        checklistItems: [],
        favorites: [],
        travelNotes: [],
      }} />
    </>
  );
}
