import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  applyImport,
  assertBackupSize,
  backupTableLabel,
  BACKUP_TABLES,
  downloadBackup,
  exportBackup,
  previewImport,
  type BackupData,
  type ImportMode,
  type ImportPreview,
} from "@/db/backup";
import { db } from "@/db/database";
import { BackupError } from "@/db/errors";
import { notifySuccess } from "@/lib/feedback";

type Phase =
  | { kind: "idle" }
  | { kind: "exporting" }
  | { kind: "reading" }
  | { kind: "preview"; data: BackupData; preview: ImportPreview; mode: ImportMode; error?: string }
  | { kind: "writing"; data: BackupData; preview: ImportPreview; mode: ImportMode }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function messageFrom(error: unknown) {
  if (error instanceof BackupError) return error.message;
  return "没有完成这次操作，请再试一次。";
}

export function BackupSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [confirm, setConfirm] = useState(false);

  async function exportFile() {
    setPhase({ kind: "exporting" });
    try {
      const file = await exportBackup(db);
      downloadBackup(file);
      setPhase({ kind: "success", message: "已下载备份文件。文件只在这台设备上生成，没有上传。" });
      notifySuccess("已下载备份");
    } catch (error) {
      setPhase({ kind: "error", message: messageFrom(error) });
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setPhase({ kind: "reading" });
    try {
      assertBackupSize(file.size);
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        throw new BackupError("这个文件不是有效的 JSON。");
      }
      const result = await previewImport(db, json);
      setPhase({ kind: "preview", data: result.data, preview: result.preview, mode: "merge" });
    } catch (error) {
      setPhase({ kind: "error", message: messageFrom(error) });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function commit(mode: ImportMode, data: BackupData, preview: ImportPreview) {
    setConfirm(false);
    setPhase({ kind: "writing", data, preview, mode });
    try {
      await applyImport(db, data, mode);
      const message =
        mode === "replace"
          ? `已用备份替换这台设备上的数据。写入 ${preview.replace.write} 条。`
          : `已合并。新增 ${preview.merge.insert} 条，覆盖 ${preview.merge.update} 条。`;
      setPhase({ kind: "success", message });
      notifySuccess(mode === "replace" ? "已替换为备份" : "已合并备份");
    } catch (error) {
      setPhase({
        kind: "preview",
        data,
        preview,
        mode,
        error: messageFrom(error),
      });
    }
  }

  const preview = phase.kind === "preview" || phase.kind === "writing" ? phase : null;
  const busy = phase.kind === "exporting" || phase.kind === "reading" || phase.kind === "writing";

  return (
    <div className="flex flex-col gap-4" data-testid="backup-section">
      <h2 className="text-sm font-medium">备份</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        导出全部行程、预算、预订、清单、收藏和备注，以及已保存的版本和路线。不含私人密钥，也不上传。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={busy} onClick={() => void exportFile()}>
          {phase.kind === "exporting" ? "正在导出" : "导出备份"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          选择备份文件
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="选择备份文件"
          onChange={(event) => void readFile(event.target.files?.[0])}
        />
      </div>
      {phase.kind === "reading" || phase.kind === "writing" ? (
        <p className="flex items-center gap-2 text-sm" role="status" aria-busy="true">
          <Spinner />
          {phase.kind === "reading" ? "正在读取备份" : "正在写入"}
        </p>
      ) : null}
      {phase.kind === "success" ? (
        <Alert data-testid="backup-success">
          <AlertTitle>已完成</AlertTitle>
          <AlertDescription>{phase.message}</AlertDescription>
        </Alert>
      ) : null}
      {phase.kind === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>没有写入</AlertTitle>
          <AlertDescription>{phase.message}现有行程还在。</AlertDescription>
        </Alert>
      ) : null}
      {preview ? (
        <div className="flex flex-col gap-4" data-testid="backup-preview">
          <h3 className="text-sm font-medium">导入预览</h3>
          {preview.preview.migratedFrom != null ? (
            <p className="text-sm leading-6 text-muted-foreground">
              这份备份是版本 {preview.preview.migratedFrom}，导入时会补齐到当前的版本 7。
              {preview.preview.migratedFrom === 1
                ? "旧的扁平行程会拆成按天的日程。"
                : ""}
            </p>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              这份备份已是当前版本
              {preview.preview.exportedAt ? `，导出时间 ${preview.preview.exportedAt}` : ""}。
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {BACKUP_TABLES.map((name) => (
              <div key={name} className="flex justify-between gap-2 border-b py-1">
                <dt className="text-muted-foreground">{backupTableLabel[name]}</dt>
                <dd className="tabular-nums">{preview.preview.counts[name]}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2" role="group" aria-label="冲突处理">
            <Button
              type="button"
              className="h-11"
              variant={preview.mode === "merge" ? "default" : "outline"}
              aria-pressed={preview.mode === "merge"}
              disabled={phase.kind === "writing"}
              onClick={() =>
                setPhase({
                  kind: "preview",
                  data: preview.data,
                  preview: preview.preview,
                  mode: "merge",
                })
              }
            >
              合并
            </Button>
            <Button
              type="button"
              className="h-11"
              variant={preview.mode === "replace" ? "default" : "outline"}
              aria-pressed={preview.mode === "replace"}
              disabled={phase.kind === "writing"}
              onClick={() =>
                setPhase({
                  kind: "preview",
                  data: preview.data,
                  preview: preview.preview,
                  mode: "replace",
                })
              }
            >
              替换
            </Button>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {preview.mode === "merge"
              ? `合并会新增 ${preview.preview.merge.insert} 条，覆盖 ${preview.preview.merge.update} 条。只在这台设备上的 ${preview.preview.merge.keepLocal} 条会留下。同一条记录以较新的修改为准。`
              : `替换会先清掉这台设备上的 ${preview.preview.replace.removeLocal} 条，再写入备份里的 ${preview.preview.replace.write} 条。`}
          </p>
          {preview.kind === "preview" && preview.error ? (
            <Alert variant="destructive">
              <AlertTitle>没有写入</AlertTitle>
              <AlertDescription>{preview.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="button"
            className="h-11"
            disabled={phase.kind === "writing"}
            onClick={() => setConfirm(true)}
          >
            确认导入
          </Button>
          <ConfirmDialog
            open={confirm}
            title={preview.mode === "replace" ? "用备份替换这台设备上的数据？" : "合并这份备份？"}
            description={
              preview.mode === "replace"
                ? "会先清掉这台设备上的行程、预算、预订和清单，再写入备份。如果写入失败，会整段撤回，不会留下半份数据。"
                : "同一条记录以较新的修改为准。只在这台设备上、不在备份里的行程会留下来。"
            }
            confirmLabel={preview.mode === "replace" ? "确认替换" : "确认合并"}
            destructive={preview.mode === "replace"}
            pending={phase.kind === "writing"}
            onOpenChange={setConfirm}
            onConfirm={() => void commit(preview.mode, preview.data, preview.preview)}
          />
        </div>
      ) : null}
    </div>
  );
}
