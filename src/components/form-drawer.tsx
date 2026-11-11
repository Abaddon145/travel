import type { FocusEvent, FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  pending = false,
  submitLabel = "保存",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  pending?: boolean;
  submitLabel?: string;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };

  const reveal = (event: FocusEvent<HTMLFormElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    requestAnimationFrame(() => {
      target.scrollIntoView?.({ block: "nearest" });
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={submit} onFocus={reveal} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 px-4 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <DrawerTitle className="min-w-0 flex-1 truncate text-center">{title}</DrawerTitle>
            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" aria-label="正在保存" /> : null}
              {submitLabel}
            </Button>
          </div>
          <DrawerDescription className="px-4 pt-2 text-center">{description}</DrawerDescription>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 pb-safe">
            {children}
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
