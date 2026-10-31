const SENSITIVE_KEYS = new Set([
  "address",
  "body",
  "email",
  "familyName",
  "givenNames",
  "password",
  "passwordHash",
  "phone",
]);

export function containsSensitiveAuditKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveAuditKey);
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(
    ([key, nestedValue]) => SENSITIVE_KEYS.has(key) || containsSensitiveAuditKey(nestedValue),
  );
}
