import type { ZodError } from "zod";

export class DatabaseUnavailableError extends Error {
  constructor() {
    super(
      "此浏览器无法使用本地数据库。旅序需要 IndexedDB 才能把行程留在这台设备上。请换用系统浏览器，或退出无痕模式后再试。",
    );
    this.name = "DatabaseUnavailableError";
  }
}

export class StorageQuotaError extends Error {
  constructor() {
    super(
      "本地存储空间不足，这次更改没有保存。可以删掉不需要的行程，或清理浏览器数据后再试。",
    );
    this.name = "StorageQuotaError";
  }
}

export class DataIntegrityError extends Error {
  constructor() {
    super("读到的本地数据无法通过校验。行程还在设备上，但这一屏暂时不能安全显示。");
    this.name = "DataIntegrityError";
  }
}

export class ValidationError extends Error {
  readonly issues: ZodError;

  constructor(issues: ZodError) {
    super("填写的内容还不能保存。");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export class LockedItemError extends Error {
  constructor(message = "这项已锁定，不能编辑、移动或删除。") {
    super(message);
    this.name = "LockedItemError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("找不到这条记录，可能刚刚被删掉了。");
    this.name = "NotFoundError";
  }
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("name" in error && error.name === "QuotaExceededError") return true;
  if ("inner" in error && error.inner && error.inner !== error) {
    return isQuotaError(error.inner);
  }
  return false;
}

export function toUserMessage(error: unknown): string {
  if (error instanceof DatabaseUnavailableError) return error.message;
  if (error instanceof StorageQuotaError) return error.message;
  if (error instanceof DataIntegrityError) return error.message;
  if (error instanceof ValidationError) return error.message;
  if (error instanceof LockedItemError) return error.message;
  if (error instanceof ConflictError) return error.message;
  if (error instanceof NotFoundError) return error.message;
  if (error instanceof BackupError) return error.message;
  if (isQuotaError(error)) return new StorageQuotaError().message;
  return "没有完成这次操作，请再试一次。";
}
