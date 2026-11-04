import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormDrawer } from "@/components/form-drawer";
import { TextField } from "@/components/text-field";
import { FieldGroup } from "@/components/ui/field";
import { db } from "@/db/database";
import { createDay, updateDay } from "@/db/repository";
import { dayInputSchema, fieldErrors } from "@/db/validation";
import type { DayView } from "@/domain/types";
import { notifyError, notifySuccess } from "@/lib/feedback";

const empty = { date: "", title: "", note: "" };

export function DayFormDrawer({
  open,
  onOpenChange,
  tripId,
  day,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  day?: DayView | null;
}) {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sourceKey = open ? (day?.id ?? "new") : "closed";
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setErrors({});
    setValues(day && open ? { date: day.date, title: day.title, note: day.note } : empty);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = dayInputSchema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error("invalid");
      }
      if (day) await updateDay(db, day.id, parsed.data);
      else await createDay(db, tripId, parsed.data);
    },
    onSuccess: () => {
      notifySuccess(day ? "这一天已更新" : "已添加一天");
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
      title={day ? "编辑这一天" : "添加一天"}
      description="日期在同一趟行程里不能重复。"
      pending={mutation.isPending}
      onSubmit={() => mutation.mutate()}
    >
      <FieldGroup>
        <TextField
          id="day-date"
          label="日期"
          type="date"
          value={values.date}
          onChange={(value) => setValues((current) => ({ ...current, date: value }))}
          error={errors.date}
        />
        <TextField
          id="day-title"
          label="标题"
          value={values.title}
          onChange={(value) => setValues((current) => ({ ...current, title: value }))}
          error={errors.title}
        />
        <TextField
          id="day-note"
          label="备注"
          multiline
          value={values.note}
          onChange={(value) => setValues((current) => ({ ...current, note: value }))}
          error={errors.note}
        />
      </FieldGroup>
    </FormDrawer>
  );
}
