import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db/database";
import { restoreVersion } from "@/db/repository";
import type { TripVersion } from "@/domain/types";
import { useTripVersions } from "@/hooks/use-travel-data";
import { notifyError } from "@/lib/feedback";

function versionPreview(version: TripVersion) {
  const names = [
    ...version.snapshot.places.map((place) => place.name),
    ...version.snapshot.lodgings.map((lodging) => lodging.name),
  ].slice(0, 6);
  const count = version.snapshot.days.length;
  return `${count} 天${names.length > 0 ? ` · ${names.join("、")}` : ""}`;
}

export function VersionDrawer({
  open,
  onOpenChange,
  tripId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
}) {
  const versions = useTripVersions(tripId);
  const [pending, setPending] = useState<TripVersion | null>(null);
  const [restored, setRestored] = useState(false);
  const mutation = useMutation({
    mutationFn: (versionId: string) => restoreVersion(db, versionId),
    onSuccess: () => {
      setRestored(true);
      setPending(null);
    },
    onError: (error) => notifyError(error),
  });

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="pb-safe">
          <div className="flex items-center gap-2 px-4 pt-2">
            <DrawerTitle className="min-w-0 flex-1">版本记录</DrawerTitle>
            <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>
          <DrawerDescription className="px-4 pt-2">
            每次有意义的修改都会留下改之前的行程。恢复会覆盖当前内容，包括已锁定的项目。
          </DrawerDescription>
          <div className="flex flex-col gap-2 overflow-y-auto px-4 py-4">
            {restored ? (
              <p role="status" className="text-sm">
                已恢复到该版本
              </p>
            ) : null}
            {versions === undefined ? (
              <Skeleton className="h-16 w-full" />
            ) : versions.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>还没有版本</EmptyTitle>
                  <EmptyDescription>保存一次修改后，就可以从这里找回。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {versions.map((version) => (
                  <li
                    key={version.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{version.label}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {new Date(version.createdAt).toLocaleString("zh-CN", {
                          hour12: false,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">{versionPreview(version)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={mutation.isPending}
                      aria-label={`恢复${version.label}`}
                      onClick={() => setPending(version)}
                    >
                      恢复
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={Boolean(pending)}
        title="恢复这个版本？"
        description={
          pending
            ? `${versionPreview(pending)}。当前行程会被替换。锁定的项目也会回到该版本里的状态。`
            : "当前行程会被替换。"
        }
        confirmLabel="恢复"
        pending={mutation.isPending}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        onConfirm={() => {
          if (pending) mutation.mutate(pending.id);
        }}
      />
    </>
  );
}
