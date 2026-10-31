export function parseAuditPage(value: string | undefined, maximum = 1000) {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(parsed, maximum));
}
