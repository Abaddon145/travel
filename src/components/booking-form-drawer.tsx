import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormDrawer } from "@/components/form-drawer";
import { TextField } from "@/components/text-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { db } from "@/db/database";
import { createBooking, updateBooking } from "@/db/tools";
import { bookingInputSchema } from "@/db/tool-validation";
import { fieldErrors } from "@/db/validation";
import type { Booking, BookingKind } from "@/domain/types";
import { notifyError, notifySuccess } from "@/lib/feedback";

const empty = {
  kind: "lodging" as BookingKind,
  title: "",
  date: "",
  endDate: "",
  reference: "",
  detail: "",
  note: "",
};

const copy: Record<
  BookingKind,
  { title: string; reference: string; detail: string; end: string }
> = {
  lodging: { title: "住宿名称", reference: "确认号", detail: "地址", end: "退房" },
  train: { title: "车次", reference: "席位", detail: "区间", end: "到达日期，可留空" },
  reservation: { title: "预订名称", reference: "单号或时间", detail: "说明", end: "结束日期，可留空" },
};

export function BookingFormDrawer({
  open,
  onOpenChange,
  tripId,
  booking,
  presetKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  booking?: Booking | null;
  presetKind?: BookingKind;
}) {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sourceKey = open ? (booking?.id ?? `new-${presetKind ?? "lodging"}`) : "closed";
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setErrors({});
    setValues(
      booking && open
        ? {
            kind: booking.kind,
            title: booking.title,
            date: booking.date,
            endDate: booking.endDate,
            reference: booking.reference,
            detail: booking.detail,
            note: booking.note,
          }
        : { ...empty, kind: presetKind ?? "lodging" },
    );
  }

  const labels = copy[values.kind];
  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = bookingInputSchema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error("invalid");
      }
      if (booking) await updateBooking(db, booking.id, parsed.data);
      else await createBooking(db, tripId, parsed.data);
    },
    onSuccess: () => {
      notifySuccess(booking ? "预订已更新" : "已记下");
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
      title={booking ? "编辑预订" : "添加预订"}
      description="住宿、车次和别的预订都挂在这趟行程上。花费仍记在预算里。"
      pending={mutation.isPending}
      onSubmit={() => mutation.mutate()}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>类型</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={values.kind}
            onValueChange={(value) => {
              if (value === "lodging" || value === "train" || value === "reservation") {
                setValues((current) => ({ ...current, kind: value }));
              }
            }}
          >
            <ToggleGroupItem value="lodging">住宿</ToggleGroupItem>
            <ToggleGroupItem value="train">车次</ToggleGroupItem>
            <ToggleGroupItem value="reservation">预订</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <TextField
          id="booking-title"
          label={labels.title}
          value={values.title}
          onChange={(title) => setValues((current) => ({ ...current, title }))}
          error={errors.title}
        />
        <TextField
          id="booking-date"
          label={values.kind === "lodging" ? "入住" : "日期"}
          type="date"
          value={values.date}
          onChange={(date) => setValues((current) => ({ ...current, date }))}
          error={errors.date}
        />
        <TextField
          id="booking-end"
          label={labels.end}
          type="date"
          value={values.endDate}
          onChange={(endDate) => setValues((current) => ({ ...current, endDate }))}
          error={errors.endDate}
        />
        <TextField
          id="booking-reference"
          label={labels.reference}
          value={values.reference}
          onChange={(reference) => setValues((current) => ({ ...current, reference }))}
          error={errors.reference}
        />
        <TextField
          id="booking-detail"
          label={labels.detail}
          value={values.detail}
          onChange={(detail) => setValues((current) => ({ ...current, detail }))}
          error={errors.detail}
        />
        <TextField
          id="booking-note"
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
