import { createHmac } from "node:crypto";
import { normalizeUsername } from "./password";

export const CREDENTIAL_ATTEMPT_LIMIT = 8;
export const CREDENTIAL_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export function createCredentialAttemptKey(username: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`credentials:${normalizeUsername(username)}`)
    .digest("hex");
}

export function isCredentialAttemptAllowed(attempts: number) {
  return Number.isSafeInteger(attempts) && attempts <= CREDENTIAL_ATTEMPT_LIMIT;
}
