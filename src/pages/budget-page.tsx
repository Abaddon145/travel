import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useParams } from "react-router";
import { BudgetChart } from "@/components/budget-chart";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LedgerFormDrawer } from "@/components/ledger-form-drawer";
import { MoneyFigure } from "@/components/money-figure";
import { TripToolsFrame } from "@/components/trip-tools-frame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db/database";
import { deleteLedgerEntry, restoreLedgerEntry } from "@/db/tools";
import {
  budgetReport,
  categoryLabel,
  isOverBudget,
  currencyLabel,
  explainVariance,
  formatMinor,
  preferredCurrency,
} from "@/domain/money";
import type { CurrencyCode, DayView, LedgerEntry, TripDetail } from "@/domain/types";
import { useQuietMotion } from "@/hooks/use-quiet-motion";
import { useTripTools } from "@/hooks/use-trip-tools";
import { formatDateWithWeekday } from "@/lib/dates";
import { notifyError, notifyUndo } from "@/lib/feedback";

function dayLabel(date: string, days: DayView[]) {
  if (!date) return "未分到某一天";
  const day = days.find((item) => item.date === date);
  const base = formatDateWithWeekday(date);
  return day ? `${base} · ${day.title}` : base;
}

function BudgetBody({
  trip,
  entries,
  quiet,
  currency,
  onCurrency,
  onEdit,
  onDelete,
}: {
  trip: TripDetail;
  entries: LedgerEntry[];
  quiet: boolean;
  currency: CurrencyCode | null;
  onCurrency: (currency: CurrencyCode) => void;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>还没有预算</EmptyTitle>
          <EmptyDescription className="[text-wrap:wrap]">
            预计和实际分开记。不同币种不会混在一起。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  let reports;
  try {
    reports = budgetReport(entries);
  } catch {
    return (
      <Alert variant="destructive">
        <AlertTitle>预算暂时算不出来</AlertTitle>
        <AlertDescription>有一笔金额超出可精确合计的范围。请先改掉特别大的数字。</AlertDescription>
      </Alert>
    );
  }

  const active =
    currency && reports.some((report) => report.currency === currency)
      ? currency
      : preferredCurrency(reports);
  const report = reports.find((item) => item.currency === active) ?? reports[0];
  if (!report) return null;
  const visible = entries.filter((entry) => entry.currency === active);
  const totalRecorded = report.total.openCount !== report.total.entryCount;
  const totalOver = totalRecorded && isOverBudget(report.total.plannedMinor, report.total.actualMinor);

  return (
    <>
      <div className="flex flex-col gap-4">
        {reports.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="币种">
            {reports.map((item) => (
              <Button
                key={item.currency}
                type="button"
                size="lg"
                variant={item.currency === active ? "default" : "outline"}
                aria-pressed={item.currency === active}
                onClick={() => onCurrency(item.currency)}
              >
                {currencyLabel[item.currency]}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{currencyLabel[active]}</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">预计</p>
            <p className="text-2xl font-medium leading-none">
              <MoneyFigure minor={report.total.plannedMinor} currency={active} quiet={quiet} />
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className={totalOver ? "text-xs text-primary" : "text-xs text-muted-foreground"}>实际</p>
            <p
              data-over={totalOver ? "true" : "false"}
              className={
                totalOver
                  ? "text-2xl font-medium leading-none text-primary"
                  : "text-2xl font-medium leading-none"
              }
            >
              <MoneyFigure minor={report.total.actualMinor} currency={active} quiet={quiet} />
            </p>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {explainVariance(report.total, active)}
        </p>
      </div>
      <BudgetChart rows={report.categories} currency={active} quiet={quiet} />
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">按天</h2>
        <ul className="flex flex-col gap-3">
          {report.days.map((day) => (
            <li key={day.date || "trip"} className="flex flex-col gap-1">
              <span className="text-sm">{dayLabel(day.date, trip.days)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                预计 {formatMinor(day.plannedMinor, active)}
                <span
                  className={
                    day.openCount !== day.entryCount && isOverBudget(day.plannedMinor, day.actualMinor)
                      ? "text-primary"
                      : undefined
                  }
                >
                  {" "}
                  · 实际{" "}
                  {day.openCount === day.entryCount
                    ? "未记"
                    : formatMinor(day.actualMinor, active)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">明细</h2>
        <ul className="divide-y divide-border">
          {visible.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-2 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{categoryLabel[entry.category]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {entry.date ? formatDateWithWeekday(entry.date) : "未分到某一天"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{entry.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    预计 {formatMinor(entry.plannedMinor, entry.currency)} ·{" "}
                    <span className={isOverBudget(entry.plannedMinor, entry.actualMinor) ? "text-primary" : undefined}>
                      实际{" "}
                      {entry.actualMinor === null
                        ? "未记"
                        : formatMinor(entry.actualMinor, entry.currency)}
                    </span>
                  </p>
                  {entry.note ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{entry.note}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(entry)}>
                  编辑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`删除${entry.title}`}
                  onClick={() => onDelete(entry)}
                >
                  <Trash2 data-icon="inline-start" />
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function BudgetPage() {
  const { tripId = "" } = useParams();
  const tools = useTripTools(tripId);
  const quiet = useQuietMotion();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LedgerEntry | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode | null>(null);
  const remove = useMutation({
    mutationFn: (entryId: string) => deleteLedgerEntry(db, entryId),
    onSuccess: (entry) => {
      setPendingDelete(null);
      notifyUndo("账目已删除", () => restoreLedgerEntry(db, entry));
    },
    onError: (error) => notifyError(error),
  });

  return (
    <TripToolsFrame
      tripId={tripId}
      title="预算"
      action={
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus data-icon="inline-start" />
          记一笔
        </Button>
      }
    >
      {(trip) => {
        const dates = trip.days.map((day) => ({
          value: day.date,
          label: `${formatDateWithWeekday(day.date)} ${day.title}`,
        }));
        return (
          <>
            {tools === undefined ? (
              <div className="flex flex-col gap-4" aria-busy="true">
                <p className="sr-only">正在读取预算</p>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <BudgetBody
                trip={trip}
                entries={tools.ledgerEntries}
                quiet={quiet}
                currency={currency}
                onCurrency={setCurrency}
                onEdit={setEditing}
                onDelete={setPendingDelete}
              />
            )}
            <LedgerFormDrawer
              open={creating || Boolean(editing)}
              onOpenChange={(open) => {
                if (!open) {
                  setCreating(false);
                  setEditing(null);
                }
              }}
              tripId={trip.id}
              entry={editing}
              dates={dates}
            />
            <ConfirmDialog
              open={Boolean(pendingDelete)}
              title="删除这笔账？"
              description="删除后可以立刻撤销。"
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
