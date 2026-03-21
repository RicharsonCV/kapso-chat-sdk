import { ValidationError } from "@chat-adapter/shared";
import type { KapsoThreadId } from "./types.js";

const KAPSO_THREAD_PREFIX = "kapso:";

export function encodeKapsoThreadId(platformData: KapsoThreadId): string {
  return `kapso:${platformData.phoneNumberId}:${platformData.userWaId}`;
}

export function decodeKapsoThreadId(threadId: string): KapsoThreadId {
  if (!threadId.startsWith(KAPSO_THREAD_PREFIX)) {
    throw new ValidationError("kapso", `Invalid Kapso thread ID: ${threadId}`);
  }

  const withoutPrefix = threadId.slice(KAPSO_THREAD_PREFIX.length);
  if (!withoutPrefix) {
    throw new ValidationError(
      "kapso",
      `Invalid Kapso thread ID format: ${threadId}`,
    );
  }

  const parts = withoutPrefix.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ValidationError(
      "kapso",
      `Invalid Kapso thread ID format: ${threadId}`,
    );
  }

  return {
    phoneNumberId: parts[0],
    userWaId: parts[1],
  };
}

export function normalizeUserWaId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\D/g, "");
  return normalized.length > 0 ? normalized : undefined;
}
