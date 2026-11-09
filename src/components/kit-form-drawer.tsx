import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FormDrawer } from "@/components/form-drawer";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import { FieldGroup } from "@/components/ui/field";
import { db } from "@/db/database";
import {
  createChecklistItem,
  createFavorite,
  createTravelNote,
  updateChecklistItem,
  updateFavorite,
  updateTravelNote,
} from "@/db/tools";
import { checklistInputSchema, favoriteInputSchema, noteInputSchema } from "@/db/tool-validation";
import { fieldErrors } from "@/db/validation";
import type { ChecklistItem, Favorite, TravelNote } from "@/domain/types";
import { notifyError, notifySuccess } from "@/lib/feedback";

type Mode = "checklist" | "favorite" | "note";

const titles: Record<Mode, string> = {
  checklist: "事项",
  favorite: "收藏",
  note: "备注",
};

export function KitFormDrawer({
  open,
  onOpenChange,
  tripId,
  mode,
  checklist,
  favorite,
  note,
  dates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  mode: Mode;
  checklist?: ChecklistItem | null;
  favorite?: Favorite | null;
  note?: TravelNote | null;
  dates: { value: string; label: string }[];
}) {
  const editing = Boolean(checklist || favorite || note);
  const sourceKey = open
    ? `${mode}:${checklist?.id ?? favorite?.id ?? note?.id ?? "new"}`
    : "closed";
  const [title, setTitle] = useState("");
  const [extra, setExtra] = useState("");
  const [date, setDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [syncedKey, setSyncedKey] = useState(sourceKey);
  if (syncedKey !== sourceKey) {
    setSyncedKey(sourceKey);
    setErrors({});
    if (!open) {
      setTitle("");
      setExtra("");
      setDate("");
    } else if (checklist) {
      setTitle(checklist.title);
      setExtra(checklist.note);
      setDate("");
    } else if (favorite) {
      setTitle(favorite.title);
      setExtra(favorite.note);
      setDate("");
    } else if (note) {
      setTitle(note.title);
      setExtra(note.body);
      setDate(note.date);
    } else {
      setTitle("");
      setExtra("");
      setDate("");
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "checklist") {
        const parsed = checklistInputSchema.safeParse({
          title,
          note: extra,
          done: checklist?.done ?? false,
        });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          throw new Error("invalid");
        }
        if (checklist) await updateChecklistItem(db, checklist.id, parsed.data);
        else await createChecklistItem(db, tripId, parsed.data);
        return;
      }
      if (mode === "favorite") {
        const parsed = favoriteInputSchema.safeParse({ title, note: extra });
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          throw new Error("invalid");
        }
        if (favorite) await updateFavorite(db, favorite.id, parsed.data);
        else await createFavorite(db, tripId, parsed.data);
        return;
      }
      const parsed = noteInputSchema.safeParse({ title, body: extra, date });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error("invalid");
      }
      if (note) await updateTravelNote(db, note.id, parsed.data);
      else await createTravelNote(db, tripId, parsed.data);
    },
    onSuccess: () => {
      notifySuccess(editing ? "已保存" : "已添加");
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "invalid") return;
      notifyError(error);
    },
  });

  const dateOptions = [...dates];
  if (date && !dateOptions.some((option) => option.value === date)) {
    dateOptions.push({ value: date, label: date });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `编辑${titles[mode]}` : `添加${titles[mode]}`}
      description="这些内容只留在这趟行程里，助手调整日程时不会改动它们。"
      pending={mutation.isPending}
      onSubmit={() => mutation.mutate()}
    >
      <FieldGroup>
        <TextField
          id="kit-title"
          label={mode === "checklist" ? "事项" : mode === "note" ? "标题" : "名称"}
          value={title}
          onChange={setTitle}
          error={errors.title}
        />
        {mode === "note" ? (
          <SelectField
            id="kit-date"
            label="日期"
            value={date}
            onChange={setDate}
            options={[{ value: "", label: "不归到某一天" }, ...dateOptions]}
            error={errors.date}
          />
        ) : null}
        <TextField
          id="kit-extra"
          label={mode === "note" ? "正文" : "备注，可留空"}
          value={extra}
          onChange={setExtra}
          error={mode === "note" ? errors.body : errors.note}
          multiline
        />
      </FieldGroup>
    </FormDrawer>
  );
}
