import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormDrawer } from "@/components/form-drawer";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import { FieldGroup } from "@/components/ui/field";
import { db } from "@/db/database";
import { fieldErrors } from "@/db/validation";
import { createLedgerEntry, updateLedgerEntry } from "@/db/tools";
import { ledgerInputSchema } from "@/db/tool-validation";
import {
  categoryLabel,
  categoryOrder,
  currencyCodes,
  currencyExponent,
  currencyLabel,
  minorToInput,
  parseMinor,
} from "@/domain/money";
import type { CurrencyCode, LedgerEntry, SpendCategory } from "@/domain/types";
import { notifyError, notifySuccess } from "@/lib/feedback";

const empty = {
  title: "",
  date: "",
  category: "lodging" as SpendCategory,
  currency: "CNY" as CurrencyCode,
  planned: "",
  actual: "",
  note: "",
};

export function LedgerFormDrawer({
  open,
  onOpenChange,
  tripId,
  entry,
  dates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  entry?: LedgerEntry | null;
  dates: { value: string; label: string }[];
}) {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sourceKey = open ? (entry?.id ?? "new") : "closed";
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setErrors({});
    setValues(
      entry && open
        ? {
            title: entry.title,
            date: entry.date,
            category: entry.category,
            currency: entry.currency,
            planned: minorToInput(entry.plannedMinor, entry.currency),
            actual: minorToInput(entry.actualMinor, entry.currency),
            note: entry.note,
          }
        : empty,
    );
  }

  const dateOptions = [...dates];
  if (values.date && !dateOptions.some((option) => option.value === values.date)) {
    dateOptions.push({ value: values.date, label: values.date });
  }
  const exponent = currencyExponent(values.currency);

  const mutation = useMutation({
    mutationFn: async () => {
      const nextErrors: Record<string, string> = {};
      const planned =
        values.planned.trim() === ""
          ? { ok: true as const, minor: 0 }
          : parseMinor(values.planned, values.currency);
      const actual =
        values.actual.trim() === ""
          ? { ok: true as const, minor: null }
          : parseMinor(values.actual, values.currency);
      if (!planned.ok) nextErrors.plannedMinor = planned.message;
      if (!actual.ok) nextErrors.actualMinor = actual.message;
      if (!planned.ok || !actual.ok) {
        setErrors(nextErrors);
        throw new Error("invalid");
      }
      const parsed = ledgerInputSchema.safeParse({
        title: values.title,
        date: values.date,
        category: values.category,
        currency: values.currency,
        note: values.note,
        plannedMinor: planned.minor,
        actualMinor: actual.minor,
      });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error("invalid");
      }
      if (entry) await updateLedgerEntry(db, entry.id, parsed.data);
      else await createLedgerEntry(db, tripId, parsed.data);
    },
    onSuccess: () => {
      notifySuccess(entry ? "账目已更新" : "已记上一笔");
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "invalid") return;
      notifyError(error);
    },
  });

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? "编辑账目" : "记一笔"}
      description="预计和实际分开记。留空的实际表示还没发生，填 0 表示确实没花。"
      pending={mutation.isPending}
      onSubmit={() => mutation.mutate()}
    >
      <FieldGroup>
        <TextField
          id="ledger-title"
          label="名称"
          value={values.title}
          onChange={(title) => setValues((current) => ({ ...current, title }))}
          error={errors.title}
        />
        <SelectField
          id="ledger-category"
          label="类别"
          value={values.category}
          onChange={(category) =>
            setValues((current) => ({ ...current, category: category as SpendCategory }))
          }
          options={categoryOrder.map((category) => ({
            value: category,
            label: categoryLabel[category],
          }))}
          error={errors.category}
        />
        <SelectField
          id="ledger-currency"
          label="币种"
          value={values.currency}
          onChange={(currency) =>
            setValues((current) => ({ ...current, currency: currency as CurrencyCode }))
          }
          options={currencyCodes.map((currency) => ({
            value: currency,
            label: currencyLabel[currency],
          }))}
        />
        <SelectField
          id="ledger-date"
          label="日期"
          value={values.date}
          onChange={(date) => setValues((current) => ({ ...current, date }))}
          options={[{ value: "", label: "不归到某一天" }, ...dateOptions]}
          error={errors.date}
        />
        <TextField
          id="ledger-planned"
          label="预计"
          value={values.planned}
          onChange={(planned) => setValues((current) => ({ ...current, planned }))}
          error={errors.plannedMinor}
          inputMode={exponent === 0 ? "numeric" : "decimal"}
          autoComplete="off"
          placeholder={exponent === 0 ? "0" : "0.00"}
        />
        <TextField
          id="ledger-actual"
          label="实际，可留空"
          value={values.actual}
          onChange={(actual) => setValues((current) => ({ ...current, actual }))}
          error={errors.actualMinor}
          inputMode={exponent === 0 ? "numeric" : "decimal"}
          autoComplete="off"
          placeholder={exponent === 0 ? "0" : "0.00"}
        />
        <TextField
          id="ledger-note"
          label="备注"
          value={values.note}
          onChange={(note) => setValues((current) => ({ ...current, note }))}
          error={errors.note}
          multiline
        />
      </FieldGroup>
    </FormDrawer>
  );
}
