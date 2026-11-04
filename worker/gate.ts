import {
  accessConfigured,
  authorizePaidRequest,
  devBypassAllowed,
  type AccessIdentity,
} from "./access";
import {
  ownerKeyConfigured,
  ownerKeyMatches,
  parseAuthMode,
  readPresentedOwnerKey,
  type GateEnv,
} from "./owner-key";

export type GateDecision =
  | { ok: true; identity: AccessIdentity | null; via: "owner-key" | "jwt" | "dev-bypass" }
  | { ok: false; reason: "unauthorized" | "unconfigured"; ownerKeyFailure: boolean };

export function gateConfigured(env: GateEnv) {
  const mode = parseAuthMode(env.AUTH_MODE);
  const ownerReady = ownerKeyConfigured(env.OWNER_KEY_SHA256);
  const accessReady = accessConfigured(env);
  if (mode === "owner-key") return ownerReady;
  if (mode === "access") return accessReady;
  if (mode === "either") return ownerReady || accessReady;
  return false;
}

export async function authorizeGate(
  request: Request,
  env: GateEnv,
  verify: (token: string, env: GateEnv) => Promise<AccessIdentity>,
): Promise<GateDecision> {
  if (devBypassAllowed(env)) {
    return { ok: true, identity: null, via: "dev-bypass" };
  }

  const mode = parseAuthMode(env.AUTH_MODE);
  if (!mode) return { ok: false, reason: "unconfigured", ownerKeyFailure: false };

  const ownerReady = ownerKeyConfigured(env.OWNER_KEY_SHA256);
  const accessReady = accessConfigured(env);
  if (mode === "owner-key" && !ownerReady) {
    return { ok: false, reason: "unconfigured", ownerKeyFailure: false };
  }
  if (mode === "access" && !accessReady) {
    return { ok: false, reason: "unconfigured", ownerKeyFailure: false };
  }
  if (mode === "either" && !ownerReady && !accessReady) {
    return { ok: false, reason: "unconfigured", ownerKeyFailure: false };
  }

  let ownerFailed = false;
  if ((mode === "owner-key" || mode === "either") && ownerReady) {
    const presented = readPresentedOwnerKey(request);
    const secret = env.OWNER_KEY_SHA256 ?? "";
    if (presented && (await ownerKeyMatches(presented, secret))) {
      return { ok: true, identity: null, via: "owner-key" };
    }
    ownerFailed = true;
    if (mode === "owner-key") {
      return { ok: false, reason: "unauthorized", ownerKeyFailure: true };
    }
  }

  if ((mode === "access" || mode === "either") && accessReady) {
    const decision = await authorizePaidRequest(request, env, verify);
    if (decision.ok) {
      return {
        ok: true,
        identity: decision.identity,
        via: decision.via === "dev-bypass" ? "dev-bypass" : "jwt",
      };
    }
    return {
      ok: false,
      reason: decision.reason,
      ownerKeyFailure: ownerFailed && decision.reason === "unauthorized",
    };
  }

  if (ownerFailed) return { ok: false, reason: "unauthorized", ownerKeyFailure: true };
  return { ok: false, reason: "unconfigured", ownerKeyFailure: false };
}
