import { toast } from "sonner";
import { toUserMessage } from "@/db/errors";

export function notifySuccess(message: string) {
  toast.success(message);
}

export function notifyError(error: unknown) {
  toast.error(toUserMessage(error));
}

export function notifyUndo(message: string, undo: () => Promise<unknown>) {
  toast.success(message, {
    action: {
      label: "撤销",
      onClick: () => {
        void undo().catch((error: unknown) => {
          toast.error(toUserMessage(error));
        });
      },
    },
  });
}
