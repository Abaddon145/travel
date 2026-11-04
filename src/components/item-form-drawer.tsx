import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormDrawer } from "@/components/form-drawer";
import { TextField } from "@/components/text-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { db } from "@/db/database";
import { createTimelineItem, updateTimelineItem } from "@/db/repository";
import { fieldErrors, itemInputSchema } from "@/db/validation";
import type { ItemKind, TimelineEntry } from "@/domain/types";
import { notifyError, notifySuccess } from "@/lib/feedback";

const empty = {
  kind: "place" as ItemKind,
  name: "",
  area: "",
  note: "",
  timeLabel: "",
  checkIn: "",
  checkOut: "",
};

export function ItemFormDrawer({
  open,
  onOpenChange,
  dayId,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayId: string;
  item?: TimelineEntry | null;
}) {
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = Boolean(item);
  const sourceKey = open ? (item?.id ?? "new") : "closed";
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setErrors({});
    setValues(
      item && open
        ? {
            kind: item.kind,
            name: item.name,
            area: item.area,
            note: item.note,
            timeLabel: item.timeLabel,
            checkIn: item.checkIn ?? "",
            checkOut: item.checkOut ?? "",
          }
        : empty,
    );
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = itemInputSchema.safeParse(values);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error("invalid");
      }
      if (item) await updateTimelineItem(db, item.id, parsed.data);
      else await createTimelineItem(db, dayId, parsed.data);
    },
    onSuccess: () => {
      notifySuccess(
        item ? "已保存" : values.kind === "place" ? "已添加景点" : "已添加住宿",
      );
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
      title={editing ? "编辑项目" : "添加景点或住宿"}
      description={
        item?.locked ? "这项已锁定，不能修改。" : "名称会显示在当天的时间线上。"
      }
      pending={mutation.isPending}
      onSubmit={() => {
        if (item?.locked) return;
        mutation.mutate();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>类型</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={values.kind}
            disabled={editing}
            onValueChange={(value) => {
              if (value === "place" || value === "lodging") {
                setValues((current) => ({ ...current, kind: value }));
              }
            }}
          >
            <ToggleGroupItem value="place">景点</ToggleGroupItem>
            <ToggleGroupItem value="lodging">住宿</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <TextField
          id="item-name"
          label="名称"
          value={values.name}
          onChange={(value) => setValues((current) => ({ ...current, name: value }))}
          error={errors.name}
        />
        <TextField
          id="item-area"
          label="区域"
          value={values.area}
          onChange={(value) => setValues((current) => ({ ...current, area: value }))}
          error={errors.area}
        />
        <TextField
          id="item-time"
          label="时间"
          value={values.timeLabel}
          onChange={(value) => setValues((current) => ({ ...current, timeLabel: value }))}
          error={errors.timeLabel}
        />
        {values.kind === "lodging" ? (
          <>
            <TextField
              id="item-check-in"
              label="入住"
              type="date"
              value={values.checkIn}
              onChange={(value) =>
                setValues((current) => ({ ...current, checkIn: value }))
              }
              error={errors.checkIn}
            />
            <TextField
              id="item-check-out"
              label="退房"
              type="date"
              value={values.checkOut}
              onChange={(value) =>
                setValues((current) => ({ ...current, checkOut: value }))
              }
              error={errors.checkOut}
            />
          </>
        ) : null}
        <TextField
          id="item-note"
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
