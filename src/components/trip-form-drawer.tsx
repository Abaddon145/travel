import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormDrawer } from "@/components/form-drawer";
import { TextField } from "@/components/text-field";
import { FieldGroup } from "@/components/ui/field";
import { db } from "@/db/database";
import { createTrip, updateTrip } from "@/db/repository";
import { fieldErrors, tripInputSchema } from "@/db/validation";
import type { TripSummary } from "@/domain/types";
import { notifyError, notifySuccess } from "@/lib/feedback";

const empty = {
  title: "",
  destination: "",
  startDate: "",
  endDate: "",
  summary: "",
};

export function TripFormDrawer({
  open,
  onOpenChange,
  trip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: TripSummary | null;
}) {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sourceKey = open ? (trip?.id ?? "new") : "closed";
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setErrors({});
    setValues(
      trip && open
        ? {
            title: trip.title,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            summary: trip.summary,
          }
        : empty,
    );
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = tripInputSchema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error("invalid");
      }
      if (trip) await updateTrip(db, trip.id, parsed.data);
      else await createTrip(db, parsed.data);
    },
    onSuccess: () => {
      notifySuccess(trip ? "行程已更新" : "行程已创建");
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "invalid") return;
      notifyError(error);
    },
  });

  const set = (key: keyof typeof empty) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={trip ? "编辑行程" : "新建行程"}
      description={
        trip ? "修改标题、日期和简介。" : "先写下目的地和日期，景点和住宿可以随后再排。"
      }
      pending={mutation.isPending}
      onSubmit={() => mutation.mutate()}
    >
      <FieldGroup>
        <TextField
          id="trip-title"
          label="标题"
          value={values.title}
          onChange={set("title")}
          error={errors.title}
        />
        <TextField
          id="trip-destination"
          label="目的地"
          value={values.destination}
          onChange={set("destination")}
          error={errors.destination}
        />
        <TextField
          id="trip-start"
          label="开始日期"
          type="date"
          value={values.startDate}
          onChange={set("startDate")}
          error={errors.startDate}
        />
        <TextField
          id="trip-end"
          label="结束日期"
          type="date"
          value={values.endDate}
          onChange={set("endDate")}
          error={errors.endDate}
        />
        <TextField
          id="trip-summary"
          label="简介"
          multiline
          value={values.summary}
          onChange={set("summary")}
          error={errors.summary}
        />
      </FieldGroup>
    </FormDrawer>
  );
}
