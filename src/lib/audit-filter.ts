export function parseAuditAction(value: string | undefined) {
  const action = value?.trim().toUpperCase().slice(0, 100);
  return action || undefined;
}
