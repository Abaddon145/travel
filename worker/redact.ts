const sensitiveKey =
  /authorization|cookie|email|secret|token|password|api[-_]?key|jwt|assertion|cf-access|owner[-_]?key|x-lvxu-owner-key/i;

const emailValue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bearerValue = /^bearer\s+\S+/i;

function looksLikeSecret(value: string) {
  return value.length >= 24 && /^[A-Za-z0-9+/=_-]+$/.test(value);
}

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = sensitiveKey.test(key)
        ? "[redacted]"
        : redactForLog(child, depth + 1);
    }
    return output;
  }
  if (
    typeof value === "string" &&
    (emailValue.test(value) || looksLikeSecret(value) || bearerValue.test(value))
  ) {
    return "[redacted]";
  }
  return value;
}

export function createLogger() {
  return (event: Record<string, unknown>) => {
    console.log(JSON.stringify(redactForLog(event)));
  };
}
