type PwaSnapshot = {
  needRefresh: boolean;
  offlineReady: boolean;
};

const idle: PwaSnapshot = { needRefresh: false, offlineReady: false };
let snapshot: PwaSnapshot = idle;
const listeners = new Set<() => void>();
let started = false;
let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => undefined;

function emit(next: PwaSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaSnapshot() {
  return snapshot;
}

export function getServerPwaSnapshot() {
  return idle;
}

export function dismissPwaRefresh() {
  if (!snapshot.needRefresh) return;
  emit({ ...snapshot, needRefresh: false });
}

export function applyPwaUpdate() {
  return updateServiceWorker(true);
}

export function ensurePwa() {
  if (started) return;
  started = true;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      updateServiceWorker = registerSW({
        immediate: true,
        onNeedRefresh() {
          emit({ ...snapshot, needRefresh: true });
        },
        onOfflineReady() {
          emit({ ...snapshot, offlineReady: true });
        },
        onRegisteredSW(_url, registration) {
          if (!registration) return;
          const check = () => {
            void registration.update().catch(() => undefined);
          };
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") check();
          });
          window.setInterval(check, 60 * 60 * 1000);
        },
        onRegisterError() {
          return undefined;
        },
      });
    })
    .catch(() => undefined);
}
